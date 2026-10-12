import prisma from '../config/prisma';

export interface IBaseDocument {
  id: string;
  _id: string;
  toObject: () => any;
  toJSON: () => any;
  save: (options?: any) => Promise<any>;
  [key: string]: any;
}

export interface PopulatedField {
  path: string;
  select?: string | Record<string, boolean | number>;
  populate?: any;
}

export type PopulateInput = string | PopulatedField | (string | PopulatedField)[];

// Helper: map foreign key property to Prisma relation property
const RELATION_FIELD_MAP: Record<string, string> = {
  userId: 'user',
  user: 'user',
  customerId: 'customer',
  customer: 'customer',
  contactId: 'contact',
  contact: 'contact',
  leadId: 'lead',
  lead: 'lead',
  dealId: 'deal',
  deal: 'deal',
  ownerId: 'owner',
  owner: 'owner',
  pipelineId: 'pipeline',
  pipeline: 'pipeline',
  stageId: 'stage',
  stage: 'stage',
  organizationId: 'organization',
  organization: 'organization',
  roleId: 'role',
  role: 'role',
  planId: 'plan',
  plan: 'plan',
  subscriptionId: 'subscription',
  subscription: 'subscription',
  sequenceId: 'sequence',
  sequence: 'sequence',
  createdBy: 'creator',
  creator: 'creator',
  uploadedBy: 'uploader',
  uploader: 'uploader',
  importedBy: 'importer',
  importer: 'importer',
  adminId: 'adminUser',
  adminUser: 'adminUser',
  assignedTo: 'assignee',
  assignee: 'assignee',
  employeeId: 'employee',
  employee: 'employee',
  convertedQuotationId: 'quotations',
  convertedInvoiceId: 'invoices',
  invoiceId: 'invoices',
  invoice: 'invoices',
  quotationId: 'quotation',
  quotation: 'quotation',
  items: 'items',
  payments: 'payments',
};

// Normalize ID helpers
export function normalizeId(val: any): any {
  if (val === null || val === undefined) return val;
  if (val instanceof Date) return val;
  if (typeof val === 'object' && val._id) return String(val._id);
  if (typeof val === 'object' && val.id) return String(val.id);
  if (typeof val === 'object' && !(val instanceof Object && val.constructor === Object) && !Array.isArray(val) && val.toString && typeof val.toString === 'function') {
    const s = val.toString();
    if (s !== '[object Object]') return s;
  }
  return val;
}

// Known Prisma DateTime field names
export const PRISMA_DATE_FIELDS = new Set([
  'date',
  'validUntil',
  'dueDate',
  'nextFollowUp',
  'lastFollowUpDate',
  'lastContacted',
  'reopenedAt',
  'convertedAt',
  'paidAt',
  'suspendedAt',
  'scheduledAt',
  'optOutTimestamp',
  'startTime',
  'endTime',
  'uploadedAt',
  'expectedCloseDate',
  'expiresAt',
  'resetPasswordExpires',
  'startDate',
  'endDate',
  'canceledAt',
  'processedAt',
  'createdAt',
  'updatedAt',
]);

// Sanitize raw object data so DateTime fields are proper Date objects for Prisma
export function sanitizeDataForPrisma(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) return data.map(sanitizeDataForPrisma);

  const clean: any = {};
  for (const [key, val] of Object.entries(data)) {
    if (val === undefined) continue;
    if (PRISMA_DATE_FIELDS.has(key)) {
      if (val === null || val === '') {
        clean[key] = null;
      } else if (typeof val === 'string' || typeof val === 'number') {
        const d = new Date(val);
        clean[key] = isNaN(d.getTime()) ? null : d;
      } else if (val instanceof Date) {
        clean[key] = val;
      } else {
        clean[key] = val;
      }
    } else {
      clean[key] = normalizeId(val);
    }
  }
  return clean;
}

// Convert Mongoose filter to Prisma where clause
export function transformFilter(filter: any, modelName?: string): any {
  if (!filter || typeof filter !== 'object') return {};

  const where: any = {};

  for (const [rawKey, rawVal] of Object.entries(filter)) {
    let key = rawKey === '_id' ? 'id' : rawKey;
    const val = rawVal;

    if (key === '$or' && Array.isArray(val)) {
      where.OR = val.map((subFilter) => transformFilter(subFilter, modelName));
      continue;
    }

    if (key === '$and' && Array.isArray(val)) {
      where.AND = val.map((subFilter) => transformFilter(subFilter, modelName));
      continue;
    }

    if (key === '$nor' && Array.isArray(val)) {
      where.NOT = {
        OR: val.map((subFilter) => transformFilter(subFilter, modelName)),
      };
      continue;
    }

    if (val === undefined) {
      continue;
    }

    // RegExp matching
    if (val instanceof RegExp) {
      where[key] = {
        contains: val.source,
        mode: val.flags.includes('i') ? 'insensitive' : 'default',
      };
      continue;
    }

    // Value is an object with operators ($in, $gte, $regex, etc.)
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      const ops = Object.keys(val);
      const isMongoOp = ops.some((k) => k.startsWith('$'));

      if (isMongoOp) {
        const fieldClause: any = {};

        for (const [op, opVal] of Object.entries(val)) {
          switch (op) {
            case '$eq':
              fieldClause.equals = normalizeId(opVal);
              break;
            case '$ne':
              fieldClause.not = normalizeId(opVal);
              break;
            case '$in': {
              const inArr = Array.isArray(opVal) ? opVal.map(normalizeId) : [normalizeId(opVal)];
              const nonNulls = inArr.filter((v) => v !== null && v !== undefined);
              const hasNull = inArr.some((v) => v === null || v === undefined);

              if (hasNull && nonNulls.length === 0) {
                fieldClause.equals = null;
              } else if (hasNull && nonNulls.length > 0) {
                where.OR = where.OR || [];
                where.OR.push({ [key]: null }, { [key]: { in: nonNulls } });
                continue;
              } else {
                fieldClause.in = nonNulls;
              }
              break;
            }
            case '$nin': {
              const ninArr = Array.isArray(opVal) ? opVal.map(normalizeId) : [normalizeId(opVal)];
              const nonNulls = ninArr.filter((v) => v !== null && v !== undefined);
              const hasNull = ninArr.some((v) => v === null || v === undefined);

              if (hasNull && nonNulls.length === 0) {
                fieldClause.not = null;
              } else if (hasNull && nonNulls.length > 0) {
                fieldClause.not = null;
                fieldClause.notIn = nonNulls;
              } else {
                fieldClause.notIn = nonNulls;
              }
              break;
            }
            case '$gt':
              fieldClause.gt = opVal;
              break;
            case '$gte':
              fieldClause.gte = opVal;
              break;
            case '$lt':
              fieldClause.lt = opVal;
              break;
            case '$lte':
              fieldClause.lte = opVal;
              break;
            case '$regex':
              fieldClause.contains = typeof opVal === 'string' ? opVal : (opVal as RegExp).source;
              fieldClause.mode = 'insensitive';
              break;
            case '$exists':
              if (opVal === false) {
                fieldClause.equals = null;
              } else if (opVal === true) {
                fieldClause.not = null;
              }
              break;
          }
        }

        where[key] = fieldClause;
        continue;
      }
    }

    // Direct value assignment
    where[key] = normalizeId(val);
  }

  return where;
}

// Convert Mongoose sort object to Prisma orderBy
export function transformSort(sortInput: any): any {
  if (!sortInput) return undefined;
  if (typeof sortInput === 'string') {
    const parts = sortInput.trim().split(/\s+/);
    return parts.map((part) => {
      if (part.startsWith('-')) {
        const f = part.substring(1);
        return { [f === '_id' ? 'id' : f]: 'desc' };
      }
      return { [part === '_id' ? 'id' : part]: 'asc' };
    });
  }

  if (typeof sortInput === 'object') {
    const entries = Object.entries(sortInput);
    if (entries.length === 0) return undefined;
    return entries.map(([f, dir]) => {
      const field = f === '_id' ? 'id' : f;
      const direction = dir === -1 || dir === 'desc' || dir === 'DESC' ? 'desc' : 'asc';
      return { [field]: direction };
    });
  }

  return undefined;
}

// Valid Prisma relation names per model
const MODEL_VALID_RELATIONS: Record<string, Set<string>> = {
  User: new Set(['userOrgRoles', 'sessions', 'auditLogs', 'assignedLeads', 'assignedTasks', 'assignedTickets', 'assignedDeals', 'assignedFollowUps', 'createdQuotations', 'assignedQuotations', 'uploadedDocs', 'assignedCases', 'createdCampaigns', 'callLogs', 'activities', 'leadImports', 'assignedByLogs', 'assignedFromLogs', 'assignedToLogs', 'saasAdminLogs', 'createdSequences']),
  Organization: new Set(['userOrgRoles', 'roles', 'subscription', 'leads', 'customers', 'contacts', 'deals', 'pipelines', 'items', 'quotations', 'invoices', 'tickets']),
  Role: new Set(['permissions', 'userOrgRoles', 'organization']),
  Permission: new Set(['rolePermissions']),
  RolePermission: new Set(['role', 'permission']),
  UserOrganizationRole: new Set(['user', 'organization', 'role']),
  Session: new Set(['user']),
  Lead: new Set(['organization', 'assignee', 'deals', 'quotations', 'invoices', 'tasks', 'activities', 'followUps', 'callLogs', 'documents', 'serviceCases', 'assignmentLogs']),
  Customer: new Set(['organization', 'contacts', 'deals', 'quotations', 'invoices', 'tickets', 'serviceCases', 'tasks', 'activities', 'followUps', 'callLogs', 'documents']),
  Contact: new Set(['organization', 'customer', 'deals', 'tickets', 'followUps', 'callLogs']),
  Pipeline: new Set(['organization', 'stages', 'deals']),
  PipelineStage: new Set(['pipeline', 'deals']),
  Deal: new Set(['organization', 'customer', 'contact', 'lead', 'owner', 'pipeline', 'stage', 'serviceCases', 'tasks', 'activities', 'callLogs', 'documents']),
  Item: new Set(['organization', 'quotationItems', 'invoiceItems']),
  Quotation: new Set(['organization', 'lead', 'customer', 'creator', 'assignee', 'items', 'invoices']),
  QuotationItem: new Set(['quotation', 'item']),
  Invoice: new Set(['organization', 'customer', 'lead', 'quotation', 'items', 'payments']),
  InvoiceItem: new Set(['invoice', 'item']),
  InvoicePayment: new Set(['invoice']),
  Task: new Set(['organization', 'assignee', 'lead', 'customer', 'deal']),
  Ticket: new Set(['organization', 'customer', 'contact', 'assignee', 'messages']),
  TicketMessage: new Set(['ticket']),
  FollowUp: new Set(['organization', 'assignee', 'lead', 'customer', 'contact']),
  FollowUpSequence: new Set(['organization', 'creator', 'steps']),
  SequenceStep: new Set(['sequence']),
  CallLog: new Set(['organization', 'employee', 'lead', 'customer', 'contact', 'deal']),
  ServiceCase: new Set(['organization', 'assignee', 'lead', 'customer', 'deal', 'checklist']),
  Document: new Set(['organization', 'uploader', 'lead', 'customer', 'deal']),
  Campaign: new Set(['organization', 'creator']),
  LeadScoreRule: new Set(['organization']),
  Activity: new Set(['organization', 'user', 'lead', 'customer', 'deal']),
  AuditLog: new Set(['organization', 'user']),
  LeadImportLog: new Set(['organization', 'user']),
  AssignmentLog: new Set(['organization', 'lead', 'assignedByUser', 'fromUser', 'toUser']),
  AssignmentRule: new Set(['organization']),
  Subscription: new Set(['organization', 'plan']),
  Plan: new Set(['subscriptions']),
  SaaSAuditLog: new Set(['adminUser']),
};

// Convert Mongoose populate into Prisma include structure
export function buildPrismaIncludes(populates: PopulateInput[], modelName?: string): any {
  if (!populates || populates.length === 0) return undefined;

  const validRelations = modelName ? MODEL_VALID_RELATIONS[modelName] : undefined;
  const include: any = {};

  const handleField = (field: string | PopulatedField) => {
    if (typeof field === 'string') {
      const parts = field.split(' ');
      for (const p of parts) {
        if (!p) continue;
        const rel = RELATION_FIELD_MAP[p] || p;
        if (validRelations && !validRelations.has(rel)) {
          continue;
        }
        if (rel === 'permissions') {
          include.permissions = { include: { permission: true } };
        } else {
          include[rel] = true;
        }
      }
    } else if (typeof field === 'object' && field.path) {
      const rel = RELATION_FIELD_MAP[field.path] || field.path;
      if (validRelations && !validRelations.has(rel)) {
        return;
      }
      if (rel === 'permissions') {
        include.permissions = { include: { permission: true } };
      } else {
        const relInclude: any = {};
        if (field.populate) {
          const subPop = buildPrismaIncludes(Array.isArray(field.populate) ? field.populate : [field.populate]);
          if (subPop) Object.assign(relInclude, subPop);
        }
        if (field.select) {
          const selectObj: any = { id: true };
          if (typeof field.select === 'string') {
            const selectFields = field.select.split(/\s+/).filter(Boolean);
            selectFields.forEach((sf) => {
              selectObj[sf === '_id' ? 'id' : sf] = true;
            });
          } else {
            Object.entries(field.select).forEach(([k, v]) => {
              if (v) selectObj[k === '_id' ? 'id' : k] = true;
            });
          }
          if (Object.keys(relInclude).length > 0) {
            selectObj.include = relInclude;
          }
          include[rel] = { select: selectObj };
        } else if (Object.keys(relInclude).length > 0) {
          include[rel] = { include: relInclude };
        } else {
          include[rel] = true;
        }
      }
    }
  };

  for (const pop of populates) {
    if (Array.isArray(pop)) {
      pop.forEach(handleField);
    } else {
      handleField(pop);
    }
  }

  return Object.keys(include).length > 0 ? include : undefined;
}

// Convert Mongoose update operators ($set, $inc, etc.) to Prisma data
export function transformUpdate(updateInput: any): any {
  if (!updateInput || typeof updateInput !== 'object') return updateInput;

  const data: any = {};

  if (updateInput.$set) {
    for (const [k, v] of Object.entries(updateInput.$set)) {
      const field = k === '_id' ? 'id' : k;
      if (PRISMA_DATE_FIELDS.has(field)) {
        if (v === null || v === '') data[field] = null;
        else if (typeof v === 'string' || typeof v === 'number') {
          const d = new Date(v);
          data[field] = isNaN(d.getTime()) ? null : d;
        } else data[field] = v;
      } else {
        data[field] = normalizeId(v);
      }
    }
  }

  if (updateInput.$inc) {
    for (const [k, v] of Object.entries(updateInput.$inc)) {
      data[k] = { increment: v as number };
    }
  }

  // Copy non-operator root fields
  for (const [k, v] of Object.entries(updateInput)) {
    if (!k.startsWith('$')) {
      const field = k === '_id' ? 'id' : k;
      if (PRISMA_DATE_FIELDS.has(field)) {
        if (v === null || v === '') data[field] = null;
        else if (typeof v === 'string' || typeof v === 'number') {
          const d = new Date(v);
          data[field] = isNaN(d.getTime()) ? null : d;
        } else data[field] = v;
      } else {
        data[field] = normalizeId(v);
      }
    }
  }

  // Strip relation objects that might be present in updates
  for (const rel of Object.values(RELATION_FIELD_MAP)) {
    if (data[rel] !== undefined && typeof data[rel] === 'object' && !(data[rel] instanceof Date) && !Array.isArray(data[rel])) {
      delete data[rel];
    }
  }
  delete data.stages;
  delete data.steps;
  delete data.items;
  delete data.payments;
  delete data.checklist;
  delete data.messages;
  delete data.userOrgRoles;

  return data;
}

// Wrap returned raw Prisma entity so it behaves like a Mongoose Document
export function wrapDocument<T = any>(rawDoc: any, modelName: string, delegate: any): T {
  if (!rawDoc || typeof rawDoc !== 'object') return rawDoc;

  // If array, wrap all items
  if (Array.isArray(rawDoc)) {
    return rawDoc.map((item) => wrapDocument(item, modelName, delegate)) as any;
  }

  const doc = { ...rawDoc };

  // Flatten permissions for Role / RolePermission relations
  // Flatten permissions for Role / RolePermission relations
  if (Array.isArray(doc.permissions)) {
    doc.permissions = doc.permissions.map((rp: any) => {
      if (rp && rp.permission) {
        return wrapDocument(rp.permission, 'permission', (prisma as any).permission);
      }
      return rp;
    });
  }

  // Wrap stages for Pipeline
  if (Array.isArray(doc.stages)) {
    doc.stages = doc.stages.map((st: any) => wrapDocument(st, 'pipelineStage', (prisma as any).pipelineStage));
  }

  // Wrap steps for FollowUpSequence
  if (Array.isArray(doc.steps)) {
    doc.steps = doc.steps.map((st: any) => wrapDocument(st, 'sequenceStep', (prisma as any).sequenceStep));
  }

  // Wrap checklist for ServiceCase
  if (Array.isArray(doc.checklist)) {
    doc.checklist = doc.checklist.map((c: any) => wrapDocument(c, 'caseChecklistItem', (prisma as any).caseChecklistItem));
  }

  // Wrap messages for Ticket
  if (Array.isArray(doc.messages)) {
    doc.messages = doc.messages.map((m: any) => wrapDocument(m, 'ticketMessage', (prisma as any).ticketMessage));
  }

  // Wrap items for Quotation / Invoice
  if (Array.isArray(doc.items)) {
    doc.items = doc.items.map((it: any) => wrapDocument(it, 'item', (prisma as any).quotationItem || (prisma as any).invoiceItem));
  }

  // Wrap payments for Invoice
  if (Array.isArray(doc.payments)) {
    doc.payments = doc.payments.map((p: any) => wrapDocument(p, 'invoicePayment', (prisma as any).invoicePayment));
  }

  // Set _id alias pointing to id
  if (doc.id !== undefined && doc._id === undefined) {
    Object.defineProperty(doc, '_id', {
      get() {
        return this.id;
      },
      set(val) {
        this.id = val;
      },
      enumerable: true,
      configurable: true,
    });
  }

  // Mongoose methods
  doc.toObject = function () {
    return { ...this, _id: this.id };
  };

  doc.toJSON = function () {
    return { ...this, _id: this.id };
  };

  doc.save = async function (_options?: any) {
    const { id, _id, toObject, toJSON, save, ...dataToSave } = this;

    // Handle Role permissions update
    if (modelName === 'Role' && dataToSave.permissions) {
      const pIds = dataToSave.permissions
        .map((p: any) => (typeof p === 'object' && p ? p.id || p._id : p))
        .filter(Boolean);
      await prisma.rolePermission.deleteMany({ where: { roleId: this.id } });
      if (pIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: pIds.map((permissionId: string) => ({ roleId: this.id, permissionId })),
        });
      }
      delete dataToSave.permissions;
    }

    // Handle ServiceCase checklist update
    if (modelName === 'ServiceCase' && dataToSave.checklist && Array.isArray(dataToSave.checklist)) {
      for (const item of dataToSave.checklist) {
        if (item.id) {
          const { id: itemId, _id: item_id, save: s, toObject: t, toJSON: j, ...itemFields } = item;
          await prisma.caseChecklistItem.update({
            where: { id: itemId },
            data: itemFields,
          });
        }
      }
      delete dataToSave.checklist;
    }

    // Handle Ticket messages update
    if (modelName === 'Ticket' && dataToSave.messages && Array.isArray(dataToSave.messages)) {
      for (const msg of dataToSave.messages) {
        if (!msg.id) {
          await prisma.ticketMessage.create({
            data: {
              ticketId: this.id,
              senderId: msg.senderId,
              senderName: msg.senderName,
              senderType: msg.senderType || 'user',
              content: msg.content || '',
              date: msg.date ? new Date(msg.date) : new Date(),
            },
          });
        }
      }
      delete dataToSave.messages;
    }

    // Handle Invoice payments update
    if (modelName === 'Invoice' && dataToSave.payments && Array.isArray(dataToSave.payments)) {
      for (const pay of dataToSave.payments) {
        if (!pay.id) {
          await prisma.invoicePayment.create({
            data: {
              invoiceId: this.id,
              amount: Number(pay.amount || 0),
              reference: pay.reference || '',
              date: pay.date ? new Date(pay.date) : new Date(),
              method: pay.method || 'cash',
            },
          });
        }
      }
      delete dataToSave.payments;
    }

    // Strip out populated relation objects so Prisma does not reject unrecognized or nested data
    for (const rel of Object.values(RELATION_FIELD_MAP)) {
      if (dataToSave[rel] !== undefined && typeof dataToSave[rel] === 'object') {
        delete dataToSave[rel];
      }
    }
    delete dataToSave.stages;
    delete dataToSave.steps;
    delete dataToSave.items;
    delete dataToSave.payments;
    delete dataToSave.checklist;
    delete dataToSave.messages;
    delete dataToSave.userOrgRoles;

    const updated = await delegate.update({
      where: { id: this.id },
      data: dataToSave,
    });
    Object.assign(this, updated);
    return this;
  };

  // Populate relation aliases if present
  for (const [fk, rel] of Object.entries(RELATION_FIELD_MAP)) {
    if (doc[rel] !== undefined) {
      doc[fk] = wrapDocument(doc[rel], rel, (prisma as any)[rel]);
      doc[rel] = doc[fk];
    }
  }

  if (Array.isArray(doc.quotations) && doc.quotations.length > 0) {
    doc.convertedQuotationId = wrapDocument(doc.quotations[0], 'quotation', (prisma as any).quotation);
  }
  if (Array.isArray(doc.invoices) && doc.invoices.length > 0) {
    doc.convertedInvoiceId = wrapDocument(doc.invoices[0], 'invoice', (prisma as any).invoice);
    doc.invoiceId = wrapDocument(doc.invoices[0], 'invoice', (prisma as any).invoice);
  }

  return doc as T;
}

// Query Builder Chain for find, findOne, findById
export class PrismaQueryBuilder<T = any> implements PromiseLike<T> {
  private _filter: any = {};
  private _sort: any = undefined;
  private _skip: number | undefined = undefined;
  private _limit: number | undefined = undefined;
  private _populates: PopulateInput[] = [];
  private _select: any = undefined;
  private _omits: string[] = [];
  private _isSingle: boolean = false;
  private _lean: boolean = false;
  private _modelName: string;
  private _delegate: any;

  constructor(modelName: string, delegate: any, filter: any = {}, isSingle: boolean = false) {
    this._modelName = modelName;
    this._delegate = delegate;
    this._filter = filter;
    this._isSingle = isSingle;
  }

  sort(sortInput: any) {
    this._sort = transformSort(sortInput);
    return this;
  }

  skip(n: number) {
    this._skip = Number(n) || 0;
    return this;
  }

  limit(n: number) {
    this._limit = Number(n) || undefined;
    return this;
  }

  populate(field: PopulateInput, select?: string | Record<string, boolean | number>) {
    if (typeof field === 'string' && select) {
      this._populates.push({ path: field, select });
    } else {
      this._populates.push(field);
    }
    return this;
  }

  select(selectInput: string | Record<string, boolean | number>) {
    if (typeof selectInput === 'string') {
      const parts = selectInput.split(/\s+/).filter(Boolean);
      const includes: string[] = [];
      const excludes: string[] = [];

      parts.forEach((p) => {
        if (p.startsWith('-')) {
          excludes.push(p.substring(1));
        } else if (p.startsWith('+')) {
          includes.push(p.substring(1));
        } else {
          includes.push(p);
        }
      });

      if (excludes.length > 0) {
        this._omits = excludes.map((f) => (f === '_id' ? 'id' : f));
      }
      if (includes.length > 0) {
        const obj: any = {};
        includes.forEach((f) => {
          obj[f === '_id' ? 'id' : f] = true;
        });
        this._select = obj;
      }
    } else if (typeof selectInput === 'object') {
      const entries = Object.entries(selectInput);
      const isExclusion = entries.some(([_, v]) => v === 0 || v === false);
      if (isExclusion) {
        this._omits = entries.filter(([_, v]) => v === 0 || v === false).map(([k]) => (k === '_id' ? 'id' : k));
      } else {
        this._select = selectInput;
      }
    }
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  session(_s: any) {
    return this;
  }

  async exec(): Promise<T> {
    const where = transformFilter(this._filter, this._modelName);
    let include = buildPrismaIncludes(this._populates, this._modelName);

    if (!this._select) {
      if (this._modelName === 'Pipeline') {
        include = { stages: { orderBy: { order: 'asc' } }, ...(include || {}) };
      } else if (this._modelName === 'FollowUpSequence') {
        include = { steps: { orderBy: { stepNumber: 'asc' } }, ...(include || {}) };
      } else if (this._modelName === 'Role') {
        include = { permissions: { include: { permission: true } }, ...(include || {}) };
      } else if (this._modelName === 'ServiceCase') {
        include = { checklist: true, ...(include || {}) };
      } else if (this._modelName === 'Ticket') {
        include = { messages: { orderBy: { date: 'asc' } }, ...(include || {}) };
      } else if (this._modelName === 'Quotation') {
        include = { items: true, ...(include || {}) };
      } else if (this._modelName === 'Invoice') {
        include = { items: true, payments: true, ...(include || {}) };
      }
    }

    const queryArgs: any = { where };

    if (this._sort) queryArgs.orderBy = this._sort;
    if (this._skip !== undefined) queryArgs.skip = this._skip;
    if (this._limit !== undefined) queryArgs.take = this._limit;
    if (include) queryArgs.include = include;
    if (this._select && !include) queryArgs.select = this._select;

    const stripOmits = (d: any) => {
      if (!d || typeof d !== 'object') return;
      for (const o of this._omits) {
        delete d[o];
        if (o === 'id') delete d._id;
        if (o === '_id') delete d.id;
      }
    };

    if (this._isSingle) {
      const result = await this._delegate.findFirst(queryArgs);
      if (this._lean) {
        const raw = result ? { ...result, _id: result.id } : null;
        if (raw && this._omits.length > 0) stripOmits(raw);
        return raw;
      }
      const wrapped = wrapDocument(result, this._modelName, this._delegate);
      if (this._omits.length > 0) stripOmits(wrapped);
      return wrapped;
    }

    const results = await this._delegate.findMany(queryArgs);
    if (this._lean) {
      const rawList = results.map((r: any) => ({ ...r, _id: r.id }));
      if (this._omits.length > 0) rawList.forEach(stripOmits);
      return rawList;
    }
    const wrapped = wrapDocument(results, this._modelName, this._delegate);
    if (this._omits.length > 0 && Array.isArray(wrapped)) {
      wrapped.forEach(stripOmits);
    }
    return wrapped;
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }
}

export async function startSession() {
  return {
    startTransaction() {},
    async commitTransaction() {},
    async abortTransaction() {},
    async endSession(..._args: any[]) {},
  };
}

export const Types = {
  ObjectId: (id?: any) => (id ? String(id) : undefined),
};

export const mongoose = {
  startSession,
  Types,
};

export interface ModelHooks<_T = any> {
  beforeCreate?: (doc: any) => Promise<any> | any;
}

// Model Factory
export function createPrismaModel<T = any>(
  modelName: string,
  delegateGetter: () => any,
  hooks?: ModelHooks<T>
) {
  const getDelegate = () => delegateGetter();

  return {
    get delegate() {
      return getDelegate();
    },

    find(filter: any = {}) {
      return new PrismaQueryBuilder<T[]>(modelName, getDelegate(), filter, false);
    },

    findOne(filter: any = {}) {
      return new PrismaQueryBuilder<T | null>(modelName, getDelegate(), filter, true);
    },

    findById(id: any) {
      const cleanId = normalizeId(id);
      return new PrismaQueryBuilder<T | null>(modelName, getDelegate(), { id: cleanId }, true);
    },

    async create(docOrDocs: any, _options?: any): Promise<any> {
      const delegate = getDelegate();
      let include: any = undefined;
      if (modelName === 'Pipeline') include = { stages: { orderBy: { order: 'asc' } } };
      else if (modelName === 'FollowUpSequence') include = { steps: { orderBy: { stepNumber: 'asc' } } };
      else if (modelName === 'Role') include = { permissions: { include: { permission: true } } };
      else if (modelName === 'ServiceCase') include = { checklist: true };
      else if (modelName === 'Ticket') include = { messages: true };
      else if (modelName === 'Quotation') include = { items: true };
      else if (modelName === 'Invoice') include = { items: true, payments: true };

      if (Array.isArray(docOrDocs)) {
        const createdList = [];
        for (const raw of docOrDocs) {
          let data = { ...raw };
          if (hooks?.beforeCreate) {
            data = await hooks.beforeCreate(data);
          }
          data = sanitizeDataForPrisma(data);
          const created = await delegate.create({ data, ...(include ? { include } : {}) });
          createdList.push(wrapDocument(created, modelName, delegate));
        }
        return createdList;
      }

      let data = { ...docOrDocs };
      if (hooks?.beforeCreate) {
        data = await hooks.beforeCreate(data);
      }
      data = sanitizeDataForPrisma(data);
      const created = await delegate.create({ data, ...(include ? { include } : {}) });
      return wrapDocument(created, modelName, delegate);
    },

    async insertMany(docs: any[]): Promise<any[]> {
      return this.create(docs);
    },

    async findByIdAndUpdate(id: any, update: any, _options?: { new?: boolean; upsert?: boolean; session?: any }): Promise<any> {
      const cleanId = normalizeId(id);
      const delegate = getDelegate();
      const data = transformUpdate(update);

      const updated = await delegate.update({
        where: { id: cleanId },
        data,
      });

      return wrapDocument(updated, modelName, delegate);
    },

    async findOneAndUpdate(filter: any, update: any, options?: { new?: boolean; upsert?: boolean; session?: any }): Promise<any> {
      const delegate = getDelegate();
      const where = transformFilter(filter, modelName);
      const existing = await delegate.findFirst({ where });

      if (!existing) {
        if (options?.upsert) {
          const data = transformUpdate(update);
          const created = await delegate.create({ data: { ...where, ...data } });
          return wrapDocument(created, modelName, delegate);
        }
        return null;
      }

      const data = transformUpdate(update);
      const updated = await delegate.update({
        where: { id: existing.id },
        data,
      });

      return wrapDocument(updated, modelName, delegate);
    },

    async updateOne(filter: any, update: any): Promise<{ acknowledged: boolean; modifiedCount: number }> {
      const delegate = getDelegate();
      const where = transformFilter(filter, modelName);
      const existing = await delegate.findFirst({ where });
      if (!existing) {
        return { acknowledged: true, modifiedCount: 0 };
      }

      const data = transformUpdate(update);
      await delegate.update({
        where: { id: existing.id },
        data,
      });

      return { acknowledged: true, modifiedCount: 1 };
    },

    async updateMany(filter: any, update: any): Promise<{ acknowledged: boolean; modifiedCount: number }> {
      const delegate = getDelegate();
      const where = transformFilter(filter, modelName);
      const data = transformUpdate(update);

      const result = await delegate.updateMany({
        where,
        data,
      });

      return { acknowledged: true, modifiedCount: result.count };
    },

    async findByIdAndDelete(id: any): Promise<any> {
      const cleanId = normalizeId(id);
      const delegate = getDelegate();
      const deleted = await delegate.delete({ where: { id: cleanId } });
      return wrapDocument(deleted, modelName, delegate);
    },

    async findOneAndDelete(filter: any): Promise<any> {
      const delegate = getDelegate();
      const where = transformFilter(filter, modelName);
      const existing = await delegate.findFirst({ where });
      if (!existing) return null;

      const deleted = await delegate.delete({ where: { id: existing.id } });
      return wrapDocument(deleted, modelName, delegate);
    },

    async deleteOne(filter: any): Promise<{ acknowledged: boolean; deletedCount: number }> {
      const res = await this.findOneAndDelete(filter);
      return { acknowledged: true, deletedCount: res ? 1 : 0 };
    },

    async deleteMany(filter: any = {}): Promise<{ acknowledged: boolean; deletedCount: number }> {
      const delegate = getDelegate();
      const where = transformFilter(filter, modelName);
      const result = await delegate.deleteMany({ where });
      return { acknowledged: true, deletedCount: result.count };
    },

    async countDocuments(filter: any = {}): Promise<number> {
      const delegate = getDelegate();
      const where = transformFilter(filter, modelName);
      return await delegate.count({ where });
    },

    async count(filter: any = {}): Promise<number> {
      return this.countDocuments(filter);
    },

    async distinct(field: string, filter: any = {}): Promise<any[]> {
      const delegate = getDelegate();
      const where = transformFilter(filter, modelName);
      const items = await delegate.findMany({
        where,
        select: { [field]: true },
        distinct: [field],
      });
      return items.map((i: any) => i[field]).filter((v: any) => v !== null && v !== undefined);
    },

    async aggregate(pipeline: any[]): Promise<any[]> {
      let where: any = {};
      let limit: number | undefined = undefined;
      let sort: any = undefined;

      for (const stage of pipeline) {
        if (stage.$match) {
          where = { ...where, ...transformFilter(stage.$match, modelName) };
        }
        if (stage.$limit) {
          limit = stage.$limit;
        }
        if (stage.$sort) {
          sort = transformSort(stage.$sort);
        }
      }

      const results = await getDelegate().findMany({
        where,
        take: limit,
        orderBy: sort,
      });

      return wrapDocument(results, modelName, getDelegate());
    },

    async startSession() {
      return startSession();
    },
  };
}
