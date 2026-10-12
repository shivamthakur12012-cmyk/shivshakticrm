import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Organization } from '../models/Organization';
import { Role } from '../models/Role';
import { UserOrganizationRole } from '../models/UserOrganizationRole';
import { Session } from '../models/Session';
import { AuditLog } from '../models/AuditLog';
import logger from '../utils/logger';
import { blacklistToken, blacklistAllUserTokens } from '../services/tokenBlacklist.service';

// Helper to sign JWTs
const signAccessToken = (userId: string, email: string): string => {
  return jwt.sign({ id: userId, email }, process.env.JWT_SECRET!, { expiresIn: '15m' });
};

const signRefreshToken = (userId: string): string => {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '7d' });
};

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, firstName, lastName, organizationName, phone, businessType, bankName, bankAccount, bankIfsc, bankUpi } = req.body;

    // 1. Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address already exists.',
        errorCode: 'EMAIL_ALREADY_EXISTS'
      });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. Create user (Mongoose ACID transaction is best for multiple models)
    const mongoSession = await User.startSession();
    mongoSession.startTransaction();

    try {
      // 3.1. Create User
      const [newUser] = await User.create(
        [
          {
            email,
            passwordHash,
            firstName,
            lastName,
            isVerified: false, // will require verification in production, mock true or verification pending
            status: 'active'
          }
        ],
        { session: mongoSession }
      );

      // 3.2. Fetch or Create Organization for Client
      let clientOrg: any;
      const isSuper = (process.env.PLATFORM_ADMIN_EMAIL && email === process.env.PLATFORM_ADMIN_EMAIL) || email === 'shivamthakur12012@gmail.com';

      if (isSuper) {
        clientOrg = await Organization.findOne({
          $or: [{ name: 'PCS' }, { name: 'Artho Vista CRM' }, { name: 'Platform Admin Organization' }]
        }).session(mongoSession) || await Organization.findOne().session(mongoSession);
      }

      if (!clientOrg) {
        const [createdOrg] = await Organization.create(
          [
            {
              name: organizationName || `${firstName}'s Workspace`,
              businessType: businessType || 'general',
              phone: phone || '9999999999',
              email: email,
              currency: 'INR',
              timezone: 'Asia/Kolkata',
              bankName: bankName || null,
              bankAccount: bankAccount || null,
              bankIfsc: bankIfsc ? bankIfsc.toUpperCase().trim() : null,
              bankUpi: bankUpi || null,
              isSuspended: false
            }
          ],
          { session: mongoSession }
        );
        clientOrg = createdOrg;
      }

      const orgId = clientOrg._id || clientOrg.id;
      const orgName = clientOrg.name;

      // 3.3. Provision dedicated tenant schema for this organization
      try {
        const { tenantSchemaService } = await import('../services/tenantSchema.service');
        await tenantSchemaService.createTenantSchema(orgId);
      } catch (schemaErr) {
        logger.warn(`Tenant schema provisioning notice for ${orgId}:`, schemaErr);
      }

      // 3.4. Create initial expired subscription (forces redirection to /subscription)
      if (!isSuper) {
        const { Subscription } = await import('../models/Subscription');
        const existingSub = await Subscription.findOne({ organizationId: orgId }).session(mongoSession);
        if (!existingSub) {
          const now = new Date();
          await Subscription.create(
            [
              {
                organizationId: orgId,
                planName: 'None (Subscription Required)',
                status: 'expired',
                startDate: now,
                endDate: now,
                priceAtPurchase: 0,
                currencyAtPurchase: 'INR',
                durationAtPurchase: 0,
                durationUnitAtPurchase: 'days',
                maxUsersAtPurchase: 10,
                paymentStatus: 'pending',
                paymentProvider: 'none'
              }
            ],
            { session: mongoSession }
          );
        }
      }

      // 3.5. Fetch Role (Super Admin for Shivam, otherwise default Admin for tenant owner)
      const roleName = isSuper ? 'Super Admin' : 'Admin';
      const userRole = await Role.findOne({ name: roleName, organizationId: null }).session(mongoSession) ||
                       await Role.findOne({ name: 'Admin', organizationId: null }).session(mongoSession);
      if (!userRole) {
        throw new Error(`Default ${roleName} role not found. Run seeds.`);
      }

      // 3.6. Link User to Organization with Admin Role
      await UserOrganizationRole.create(
        [
          {
            userId: newUser._id,
            organizationId: orgId,
            roleId: userRole._id
          }
        ],
        { session: mongoSession }
      );

      // 3.5. Audit log
      await AuditLog.create(
        [
          {
            userId: newUser._id,
            organizationId: orgId,
            action: 'USER_REGISTERED',
            entity: 'User',
            entityId: newUser._id.toString(),
            newValue: { email, role: roleName }
          }
        ],
        { session: mongoSession }
      );

      await mongoSession.commitTransaction();
      mongoSession.endSession();

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully.',
        data: {
          user: {
            id: newUser._id,
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName
          },
          organization: {
            id: orgId,
            name: orgName
          }
        }
      });
    } catch (err) {
      await mongoSession.abortTransaction();
      mongoSession.endSession();
      throw err;
    }
  } catch (error) {
    logger.error('Registration controller error:', error);
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Your account is deactivated.',
        errorCode: 'ACCOUNT_DEACTIVATED'
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      // Record failed login or log it
      logger.warn(`Failed login attempt for user: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        errorCode: 'INVALID_CREDENTIALS'
      });
    }

    // Sign tokens
    const accessToken = signAccessToken(user._id.toString(), user.email);
    const refreshToken = signRefreshToken(user._id.toString());

    // Create session record
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    await Session.create({
      userId: user._id,
      token: refreshToken,
      expiresAt,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Set refresh token in HTTP-Only cookie
    const sameSiteMode = (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || sameSiteMode === 'none',
      sameSite: sameSiteMode,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Get user organization mappings
    const mappings = await UserOrganizationRole.find({ userId: user._id })
      .populate('organizationId', 'name businessType logoUrl isSuspended')
      .populate({
        path: 'roleId',
        populate: { path: 'permissions', select: 'name' }
      });

    const activeOrganizations = mappings
      .filter((m: any) => (m.organization || m.organizationId) && !(m.organization?.isSuspended || m.organizationId?.isSuspended))
      .map((m: any) => {
        const org = m.organization || m.organizationId;
        const role = m.role || m.roleId;
        const orgId = typeof org === 'object' && org ? (org.id || org._id) : (m.organizationId || org);
        return {
          id: orgId,
          name: typeof org === 'object' && org?.name ? org.name : 'PCS',
          businessType: typeof org === 'object' && org?.businessType ? org.businessType : 'general',
          logoUrl: typeof org === 'object' && org?.logoUrl ? org.logoUrl : undefined,
          role: typeof role === 'object' && role?.name ? role.name : 'Admin',
          permissions: (typeof role === 'object' && role?.permissions) 
            ? role.permissions.map((p: any) => (typeof p === 'object' && p ? p.name : p)) 
            : []
        };
      });

    // Audit log
    await AuditLog.create({
      userId: user._id,
      action: 'USER_LOGGED_IN',
      entity: 'User',
      entityId: user._id.toString()
    });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      data: {
        token: accessToken,
        user: {
          id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        },
        organizations: activeOrganizations
      }
    });
  } catch (error) {
    logger.error('Login controller error:', error);
    next(error);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required.',
        errorCode: 'REFRESH_TOKEN_REQUIRED'
      });
    }

    // Verify session in db
    const session = await Session.findOne({ token: refreshToken, isRevoked: false });
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session.',
        errorCode: 'INVALID_SESSION'
      });
    }

    // Decode refresh token
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { id: string };
      const user = await User.findById(decoded.id);

      if (!user || user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'User account inactive or deleted.',
          errorCode: 'USER_INACTIVE'
        });
      }

      // Issue new access token
      const accessToken = signAccessToken(user._id.toString(), user.email);

      return res.json({
        success: true,
        data: {
          token: accessToken
        }
      });
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Token verification failed.',
        errorCode: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    logger.error('Token refresh error:', error);
    next(error);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Blacklist Access Token in Redis
    let accessToken = '';
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.access_token) {
      accessToken = req.cookies.access_token;
    }

    if (accessToken) {
      await blacklistToken(accessToken);
    }

    // 2. Revoke Refresh Token in PostgreSQL Session
    const refreshToken = req.cookies.refresh_token || req.body.refreshToken;
    if (refreshToken) {
      await Session.updateOne({ token: refreshToken }, { isRevoked: true });
    }

    const sameSiteMode = (process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none') || 'lax';
    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || sameSiteMode === 'none',
      sameSite: sameSiteMode
    };
    res.clearCookie('refresh_token', clearOptions);
    res.clearCookie('access_token', clearOptions);

    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthenticated.',
        errorCode: 'UNAUTHORIZED'
      });
    }

    const user = await User.findById(req.user.id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND'
      });
    }

    const mappings = await UserOrganizationRole.find({ userId: user._id })
      .populate('organizationId', 'name businessType logoUrl isSuspended bankName bankAccount bankIfsc bankUpi')
      .populate({
        path: 'roleId',
        populate: { path: 'permissions', select: 'name' }
      });

    const organizations = mappings
      .filter((m: any) => (m.organization || m.organizationId) && !(m.organization?.isSuspended || m.organizationId?.isSuspended))
      .map((m: any) => {
        const org = m.organization || m.organizationId;
        const role = m.role || m.roleId;
        const orgId = typeof org === 'object' && org ? (org.id || org._id) : (m.organizationId || org);
        return {
          id: orgId,
          name: typeof org === 'object' && org?.name ? org.name : 'PCS',
          businessType: typeof org === 'object' && org?.businessType ? org.businessType : 'general',
          logoUrl: typeof org === 'object' && org?.logoUrl ? org.logoUrl : undefined,
          bankName: typeof org === 'object' ? org?.bankName : undefined,
          bankAccount: typeof org === 'object' ? org?.bankAccount : undefined,
          bankIfsc: typeof org === 'object' ? org?.bankIfsc : undefined,
          bankUpi: typeof org === 'object' ? org?.bankUpi : undefined,
          isSuspended: typeof org === 'object' && org ? org.isSuspended : false,
          role: typeof role === 'object' && role?.name ? role.name : 'Admin',
          permissions: (typeof role === 'object' && role?.permissions) 
            ? role.permissions.map((p: any) => (typeof p === 'object' && p ? p.name : p)) 
            : []
        };
      });

    return res.json({
      success: true,
      data: {
        user,
        organizations
      }
    });
  } catch (error) {
    logger.error('GetMe error:', error);
    next(error);
  }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      // Security best practice: don't reveal if email doesn't exist
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent.'
      });
    }

    // Generate mock token
    const resetToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET!, { expiresIn: '1h' });
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    logger.info(`Password reset link (mock) requested for: ${email}. Reset Token: ${resetToken}`);

    // In a real application, email sending would be queued via BullMQ here.
    return res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
      // Expose reset token in development mode only for easy manual validation
      ...(process.env.NODE_ENV !== 'production' && { devResetToken: resetToken })
    });
  } catch (error) {
    logger.error('ForgotPassword error:', error);
    next(error);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token.',
        errorCode: 'INVALID_RESET_TOKEN'
      });
    }

    // Hash new password
    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Instantly invalidate all previous active tokens and sessions across all devices
    const userId = String(user.id || user._id);
    await blacklistAllUserTokens(userId);
    await Session.deleteMany({ userId });

    logger.info(`Password reset successful and all sessions revoked for: ${user.email}`);

    return res.json({
      success: true,
      message: 'Password has been reset successfully.'
    });
  } catch (error) {
    logger.error('ResetPassword error:', error);
    next(error);
  }
}
