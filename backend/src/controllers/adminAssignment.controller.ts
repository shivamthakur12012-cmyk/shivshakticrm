import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { Lead } from '../models/Lead';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Role } from '../models/Role';
import { User } from '../models/User';
import { FollowUp } from '../models/FollowUp'; 
import { Session } from '../models/Session';
import { Activity } from '../models/Activity';
import { Organization } from '../models/Organization';
import { AssignmentLog } from '../models/AssignmentLog';
import { AuditLog } from '../models/AuditLog';
import { saasService } from '../services/saas.service';
import { blacklistAllUserTokens } from '../services/tokenBlacklist.service';

// GET WORKLOAD & AUTO ASSIGNMENT CONFIG
export async function getAssignmentConfig(req: Request, res: Response, next: NextFunction) {
  try {
    let orgId = req.organizationId;
    if (!orgId) {
      const firstOrg = await Organization.findOne({ isDeleted: false });
      orgId = firstOrg ? (firstOrg._id || firstOrg.id) : undefined;
    }
    const userRole = (req as any).userRole;
    const isSuperAdmin = ['Super Admin', 'Admin'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    const isManager = isSuperAdmin || userRole === 'Manager';
    const isTeamLeader = isManager || userRole === 'Team Leader';

    // 1. Fetch sales roles in this organization (4-level hierarchy)
    const salesRoles = await Role.find({ 
      name: { $in: ['Admin', 'Super Admin', 'Manager', 'Team Leader', 'Sale Executive', 'Sales Executive', 'Employee'] }, 
      organizationId: null 
    });
    const roleIds = salesRoles.map(r => r._id);

    const userRoles = await UserOrganizationRole.find({
      organizationId: orgId,
      roleId: { $in: roleIds }
    }).populate('userId', 'firstName lastName email status')
      .populate('roleId', 'name');

    // 2. Fetch workload stats per rep (conceal Admin/Super Admin for non-admins)
    const repsWorkload = (await Promise.all(
      userRoles
        .map(async (ur: any) => {
          const u = (typeof ur.userId === 'object' && ur.userId) ? ur.userId : (ur.user || ur.userId);
          const roleObj = (typeof ur.roleId === 'object' && ur.roleId) ? ur.roleId : (ur.role || ur.roleId);
          if (!u || u.status !== 'active') return null;
          const roleName = roleObj?.name || 'Sale Executive';
          // Conceal Admin/Super Admin profile if requester is not Admin
          if (!isSuperAdmin && ['Super Admin', 'Admin'].includes(roleName)) return null;

          const repId = u._id || u.id;
          const [totalAssigned, openLeads, convertedLeads, lostLeads] = await Promise.all([
            Lead.countDocuments({ organizationId: orgId, assignedTo: repId, isDeleted: false }),
            Lead.countDocuments({ organizationId: orgId, assignedTo: repId, status: { $in: ['New', 'Open'] }, isDeleted: false }),
            Lead.countDocuments({ organizationId: orgId, assignedTo: repId, status: 'Converted', isDeleted: false }),
            Lead.countDocuments({ organizationId: orgId, assignedTo: repId, status: 'Lost', isDeleted: false })
          ]);

          const conversionRate = totalAssigned > 0 ? Math.round((convertedLeads / totalAssigned) * 100) : 0;

          return {
            user: u,
            role: roleName,
            workload: {
              totalAssigned,
              openLeads,
              convertedLeads,
              lostLeads,
              conversionRate
            }
          };
        })
    )).filter(Boolean);

    // 3. Fetch unassigned count
    const unassignedCount = await Lead.countDocuments({
      organizationId: orgId,
      assignedTo: { $in: [null, undefined] },
      isDeleted: false
    });

    return res.json({
      success: true,
      data: {
        reps: repsWorkload,
        unassignedCount,
        autoAssignEnabled: isSuperAdmin,
        isSuperAdmin,
        isManager,
        isTeamLeader,
        rules: [
          { id: 'round_robin', name: 'Round Robin Distribution', enabled: true, description: 'Evenly distributes incoming leads across all active sales reps sequentially.' },
          { id: 'source_indiamart', name: 'IndiaMART Priority Routing', enabled: false, description: 'Routes high-intent IndiaMART B2B leads to senior sales managers.' },
          { id: 'source_justdial', name: 'JustDial Local Routing', enabled: false, description: 'Routes local JustDial callers to immediate response team.' }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
}

// BULK AUTO-ASSIGN UNASSIGNED LEADS (Admin and Manager only)
export async function autoAssignUnassignedLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole;
    const isSuperAdmin = ['Super Admin', 'Admin', 'Manager'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins and Managers can execute auto-assignment rules.',
        errorCode: 'FORBIDDEN'
      });
    }

    const orgId = req.organizationId;
    const userId = req.user?.id;
    const { limit = 50 } = req.body;

    const unassignedLeads = await Lead.find({
      organizationId: orgId,
      assignedTo: { $in: [null, undefined] },
      isDeleted: false
    }).limit(Number(limit));

    if (unassignedLeads.length === 0) {
      return res.json({
        success: true,
        message: 'No unassigned leads found.',
        assignedCount: 0
      });
    }

    // Fetch active sales reps across all 4 tiers
    const salesRoles = await Role.find({ 
      name: { $in: ['Admin', 'Super Admin', 'Manager', 'Team Leader', 'Sale Executive', 'Sales Executive', 'Employee'] }, 
      organizationId: null 
    });
    const roleIds = salesRoles.map(r => r._id);

    const userRoles = await UserOrganizationRole.find({
      organizationId: orgId,
      roleId: { $in: roleIds }
    }).populate('userId', 'status firstName lastName email');

    const activeReps = userRoles
      .filter((ur: any) => ur.userId && ur.userId.status === 'active')
      .map((ur: any) => ur.userId);

    if (activeReps.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active sales reps available for auto-assignment.',
        errorCode: 'NO_ACTIVE_REPS'
      });
    }

    let assignedCount = 0;
    for (let i = 0; i < unassignedLeads.length; i++) {
      const lead = unassignedLeads[i];
      const rep = activeReps[i % activeReps.length];

      lead.assignedTo = rep._id;
      lead.status = 'Open';
      await lead.save();

      await AssignmentLog.create({
        organizationId: orgId,
        leadId: lead._id,
        assignedBy: userId,
        toUserId: rep._id,
        ruleApplied: 'round_robin',
        reason: 'Bulk auto-assignment rule executed'
      });

      assignedCount++;
    }

    return res.json({
      success: true,
      message: `Successfully auto-assigned ${assignedCount} lead(s) across ${activeReps.length} sales reps.`,
      assignedCount
    });
  } catch (error) {
    next(error);
  }
}

// REGISTER NEW TEAM MEMBER (4-Level Hierarchy: 1. Admin, 2. Manager, 3. Team Leader, 4. Sale Executive)
export async function registerEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole;
    const isAuthorized = ['Super Admin', 'Admin', 'Manager'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins and Managers can register new team members.',
        errorCode: 'FORBIDDEN'
      });
    }

    let orgId = req.organizationId;
    if (!orgId) {
      const firstOrg = await Organization.findOne({ isDeleted: false });
      orgId = firstOrg ? (firstOrg._id || firstOrg.id) : undefined;
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'No organization context found for this request.',
        errorCode: 'ORGANIZATION_REQUIRED'
      });
    }

    // Check organization employee seat limits
    const { subscription, usage } = await saasService.getOrganizationSubscription(orgId);
    const maxLimit = subscription.maxUsersAtPurchase ?? 10;
    const currentUsers = usage.users;

    if (maxLimit !== -1 && maxLimit !== 99999 && currentUsers >= maxLimit) {
      return res.status(403).json({
        success: false,
        errorCode: 'EMPLOYEE_LIMIT_REACHED',
        message: `Team seat capacity reached (${currentUsers}/${maxLimit} employees). You can add extra employee seats anytime at ₹500/employee.`,
        data: {
          currentCount: currentUsers,
          maxLimit,
          pricePerSeat: 500,
          planName: subscription.planName
        }
      });
    }

    const adminId = req.user?.id;
    const { firstName, lastName, email, password, role = 'Sale Executive' } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, email, and password are required.',
        errorCode: 'MISSING_FIELDS'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
        errorCode: 'WEAK_PASSWORD'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Normalize role to 4-tier hierarchy
    let cleanRole = role;
    if (role === 'Super Admin' || role === 'Admin') cleanRole = 'Admin';
    else if (role === 'Manager') cleanRole = 'Manager';
    else if (role === 'Team Leader') cleanRole = 'Team Leader';
    else if (role === 'Sale Executive' || role === 'Sales Executive' || role === 'Employee') cleanRole = 'Sale Executive';
    else cleanRole = 'Sale Executive';

    // Check if user already exists
    let user: any = await User.findOne({ email: cleanEmail });

    if (user) {
      // Check if user is already a member of this organization
      const existingMembership = await UserOrganizationRole.findOne({
        userId: user._id,
        organizationId: orgId
      });

      if (existingMembership) {
        return res.status(409).json({
          success: false,
          message: `User with email ${cleanEmail} is already registered in this organization.`,
          errorCode: 'USER_ALREADY_EXISTS'
        });
      }
    } else {
      // Create new User
      const passwordHash = await bcrypt.hash(password, 10);
      user = await User.create({
        email: cleanEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isVerified: true,
        status: 'active'
      });
    }

    if (!user) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create or retrieve user account.',
        errorCode: 'INTERNAL_ERROR'
      });
    }

    // Find Role in DB
    let roleDoc: any = await Role.findOne({ name: cleanRole, organizationId: null });
    if (!roleDoc && cleanRole === 'Admin') {
      roleDoc = await Role.findOne({ name: 'Super Admin', organizationId: null });
    }
    if (!roleDoc && cleanRole === 'Sale Executive') {
      roleDoc = await Role.findOne({ name: 'Employee', organizationId: null });
    }
    if (!roleDoc) {
      roleDoc = await Role.findOne({ organizationId: null });
    }

    if (!roleDoc) {
      return res.status(500).json({
        success: false,
        message: `Role "${cleanRole}" not configured in system. Please run seed.`,
        errorCode: 'ROLE_NOT_CONFIGURED'
      });
    }


    // Link user to active organization
    await UserOrganizationRole.create({
      userId: user._id,
      organizationId: orgId,
      roleId: roleDoc._id
    });

    // Create Audit Log
    await AuditLog.create({
      userId: adminId,
      organizationId: orgId,
      action: 'EMPLOYEE_REGISTERED',
      entity: 'User',
      entityId: user._id.toString(),
      newValue: { email: cleanEmail, role: cleanRole, firstName, lastName }
    });

    return res.status(201).json({
      success: true,
      message: `Employee "${firstName} ${lastName}" (${cleanRole}) registered successfully.`,
      data: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: cleanRole,
        status: user.status
      }
    });
  } catch (error) {
    next(error);
  }
}

// GET DETAILED EMPLOYEES & TEAM MEMBERS LIST (Conceals Admin/Super Admin for non-admins)
export async function getEmployeesList(req: Request, res: Response, next: NextFunction) {
  try {
    let orgId = req.organizationId;
    if (!orgId) {
      const firstOrg = await Organization.findOne({ isDeleted: false });
      orgId = firstOrg ? (firstOrg._id || firstOrg.id) : undefined;
    }
    const userRole = (req as any).userRole;
    const isAuthorized = ['Super Admin', 'Admin', 'Manager', 'Team Leader'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins, Managers, and Team Leaders can view the team directory.',
        errorCode: 'FORBIDDEN'
      });
    }

    const isSuperAdmin = ['Super Admin', 'Admin'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';

    const memberships = await UserOrganizationRole.find({ organizationId: orgId })
      .populate('userId', 'firstName lastName email status createdAt')
      .populate('roleId', 'name');


    const filteredMemberships = memberships.filter((m: any) => {
      if (!m.userId) return false;
      const roleName = m.roleId?.name || 'Employee';
      // Conceal Super Admin from non-super-admins
      if (!isSuperAdmin && roleName === 'Super Admin') return false;
      return true;
    });

    const employees = await Promise.all(
      filteredMemberships.map(async (m: any) => {
        const u = m.userId;
        const [totalAssigned, openLeads, convertedLeads, lostLeads] = await Promise.all([
          Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, isDeleted: false }),
          Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, status: { $in: ['New', 'Open'] }, isDeleted: false }),
          Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, status: 'Converted', isDeleted: false }),
          Lead.countDocuments({ organizationId: orgId, assignedTo: u._id, status: 'Lost', isDeleted: false })
        ]);

        const conversionRate = totalAssigned > 0 ? Math.round((convertedLeads / totalAssigned) * 100) : 0;

        return {
          id: u._id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          status: u.status || 'active',
          role: m.roleId?.name || 'Employee',
          createdAt: u.createdAt,
          workload: {
            totalAssigned,
            openLeads,
            convertedLeads,
            lostLeads,
            conversionRate
          }
        };
      })
    );

    let maxSeats = 10;
    let isLimitReached = false;
    let planName = 'Starter';

    if (orgId) {
      const { subscription } = await saasService.getOrganizationSubscription(String(orgId));
      maxSeats = subscription.maxUsersAtPurchase ?? 10;
      isLimitReached = maxSeats !== -1 && employees.length >= maxSeats;
      planName = subscription.planName;
    }

    return res.json({
      success: true,
      data: employees,
      meta: {
        totalEmployees: employees.length,
        seatLimit: maxSeats,
        isLimitReached,
        pricePerSeat: 500,
        planName
      }
    });
  } catch (error) {
    next(error);
  }
}

// TOGGLE EMPLOYEE STATUS (Super Admin / Admin only)
export async function toggleEmployeeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole;
    const isAuthorized = ['Super Admin', 'Admin'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins can manage employee statuses.',
        errorCode: 'FORBIDDEN'
      });
    }

    const { id } = req.params;
    const { status } = req.body; // 'active' | 'inactive'

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (id === req.user?.id || user.email === 'shivamthakur12012@gmail.com') {
      return res.status(400).json({
        success: false,
        message: 'Super Admin account status cannot be deactivated.',
        errorCode: 'CANNOT_MODIFY_SUPER_ADMIN'
      });
    }

    user.status = status || (user.status === 'active' ? 'inactive' : 'active');
    await user.save();

    await AuditLog.create({
      userId: req.user?.id,
      organizationId: req.organizationId,
      action: 'EMPLOYEE_STATUS_TOGGLED',
      entity: 'User',
      entityId: user._id.toString(),
      newValue: { status: user.status }
    });

    return res.json({
      success: true,
      message: `User status changed to ${user.status}.`,
      data: { id: user._id, status: user.status }
    });
  } catch (error) {
    next(error);
  }
}

// DELETE EMPLOYEE & SAFELY TRANSFER ASSIGNED LEADS TO UNASSIGNED QUEUE (Super Admin / Admin only)
export async function deleteEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = (req as any).userRole;
    const isAuthorized = ['Super Admin', 'Admin'].includes(userRole) || req.user?.email === 'shivamthakur12012@gmail.com';
    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only Admins can delete employees.',
        errorCode: 'FORBIDDEN'
      });
    }

    const { id } = req.params;
    const orgId = req.organizationId;
    const adminId = req.user?.id;

    if (id === adminId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own Admin account.',
        errorCode: 'CANNOT_DELETE_SELF'
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'NOT_FOUND'
      });
    }

    if (user.email === 'shivamthakur12012@gmail.com') {
      return res.status(400).json({
        success: false,
        message: 'The primary Super Admin account cannot be deleted.',
        errorCode: 'CANNOT_DELETE_SUPER_ADMIN'
      });
    }

    // 1. Find all assigned leads in this organization
    const assignedLeads = await Lead.find({
      organizationId: orgId,
      assignedTo: id,
      isDeleted: false
    });

    // 2. Safely unassign all leads and move to unassigned queue
    for (const lead of assignedLeads) {
      lead.assignedTo = null;
      if (lead.status === 'New' || lead.status === 'Open') {
        lead.status = 'Open';
      }
      if ((lead as any).save) await (lead as any).save();

      await Activity.create({
        organizationId: orgId,
        leadId: lead._id,
        userId: adminId,
        type: 'assignment_change',
        content: `Lead moved to Unassigned Queue due to deletion of employee (${user.firstName} ${user.lastName}).`,
        metadata: { fromRep: id, toRep: null }
      });
    }

    // 3. Clean up pending follow-ups for this employee
    await FollowUp.deleteMany({
      organizationId: orgId,
      assignedTo: id,
      status: 'pending'
    });

    // 4. Remove UserOrganizationRole
    await UserOrganizationRole.deleteMany({
      userId: id,
      organizationId: orgId
    });

    // 5. Clean up user sessions and revoke all tokens in Redis immediately
    await Session.deleteMany({ userId: id });
    await blacklistAllUserTokens(id);

    // 6. Deactivate user status
    user.status = 'inactive';
    if ((user as any).save) await (user as any).save();

    // 7. Write Audit Log
    await AuditLog.create({
      userId: adminId,
      organizationId: orgId,
      action: 'EMPLOYEE_DELETED',
      entity: 'User',
      entityId: id,
      newValue: {
        deletedEmail: user.email,
        deletedName: `${user.firstName} ${user.lastName}`,
        unassignedLeadsCount: assignedLeads.length
      }
    });

    return res.json({
      success: true,
      message: `Employee "${user.firstName} ${user.lastName}" deleted successfully. ${assignedLeads.length} lead(s) moved to Unassigned Queue.`,
      data: {
        id,
        unassignedLeadsCount: assignedLeads.length
      }
    });
  } catch (error) {
    next(error);
  }
}

