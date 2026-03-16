import { supabase } from '@/integrations/supabase/client';

export async function adminQuery(action: string, params: any = {}): Promise<any> {
  switch (action) {
    // ===== STATS =====
    case 'get_stats': return getStats(params);

    // ===== USERS =====
    case 'list_users': return listUsers();
    case 'update_user': return updateUser(params);
    case 'delete_user': return deleteUser(params);
    case 'change_role': return changeRole(params);

    // ===== ORGANIZATIONS =====
    case 'list_organizations': return listOrganizations();
    case 'create_organization': return createOrganization(params);
    case 'delete_organization': return deleteOrganization(params);
    case 'list_org_members': return listOrgMembers(params);
    case 'add_org_member': return addOrgMember(params);
    case 'remove_org_member': return removeOrgMember(params);

    // ===== LEADS =====
    case 'list_leads': return listLeads();
    case 'create_lead': return createLead(params);
    case 'update_lead': return updateLead(params);
    case 'delete_lead': return deleteLead(params);

    // ===== ENROLLMENTS =====
    case 'list_enrollments': return listEnrollments();

    // ===== SCHEDULES =====
    case 'list_schedules': return listSchedules(params);
    case 'create_schedule': return createSchedule(params);
    case 'update_schedule': return updateSchedule(params);
    case 'delete_schedule': return deleteSchedule(params);

    // ===== ATTENDANCE =====
    case 'list_attendance': return listAttendance(params);
    case 'save_attendance': return saveAttendance(params);

    // ===== LIVE CLASSES =====
    case 'list_live_classes': return listLiveClasses();
    case 'create_live_class': return createLiveClass(params);
    case 'update_live_class': return updateLiveClass(params);
    case 'delete_live_class': return deleteLiveClass(params);

    // ===== MATERIALS =====
    case 'list_materials': return listMaterials(params);
    case 'create_material': return createMaterial(params);
    case 'delete_material': return deleteMaterial(params);

    // ===== PAYMENTS =====
    case 'list_payments': return listPayments();
    case 'create_payment': return createPayment(params);
    case 'update_payment': return updatePayment(params);

    // ===== PAYROLL =====
    case 'list_payroll': return listPayroll();
    case 'create_payroll': return createPayroll(params);
    case 'update_payroll': return updatePayroll(params);

    // ===== NOTIFICATIONS =====
    case 'list_notifications': return listNotifications();
    case 'create_notification': return createNotification(params);
    case 'mark_read': return markRead(params);
    case 'delete_notification': return deleteNotification(params);

    // ===== STUDENTS =====
    case 'list_students_with_batches': return listStudentsWithBatches();
    case 'list_teachers': return listTeachers();
    case 'list_all_students': return listAllStudents();

    // ===== COURSES =====
    case 'list_courses': return listCourses();
    case 'create_course': return createCourse(params);
    case 'delete_course': return deleteCourse(params);

    // ===== BATCHES =====
    case 'list_batches': return listBatches(params);
    case 'create_batch': return createBatch(params);
    case 'update_batch': return updateBatch(params);
    case 'delete_batch': return deleteBatch(params);
    case 'list_batch_students': return listBatchStudents(params);
    case 'add_batch_student': return addBatchStudent(params);
    case 'remove_batch_student': return removeBatchStudent(params);
    case 'batch_student_count': return batchStudentCount(params);

    // ===== EDGE FUNCTION ACTIONS (require service role) =====
    case 'toggle_org_active':
    case 'toggle_user_active':
    case 'create_user':
    case 'admin_reset_password':
    case 'list_activity_logs':
    case 'revenue_analytics':
    case 'org_performance':
    case 'student_trends':
      return edgeFunctionAction(action, params);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ===== STATS (live query, org-scoped) =====
async function getStats(params: { organizationId?: string | null; isSuperadmin?: boolean } = {}) {
  const { organizationId, isSuperadmin } = params;
  const scoped = !isSuperadmin && !!organizationId;

  // Courses count
  let coursesQ = supabase.from('courses' as any).select('id', { count: 'exact', head: true }) as any;
  if (scoped) coursesQ = coursesQ.eq('organization_id', organizationId);
  const { count: totalCourses } = await coursesQ;

  // Batches count
  let batchesQ = supabase.from('batches' as any).select('id', { count: 'exact', head: true }) as any;
  if (scoped) batchesQ = batchesQ.eq('organization_id', organizationId);
  const { count: totalBatches } = await batchesQ;

  // Org members (users in this org) or total users
  let totalUsers = 0;
  if (scoped) {
    const { count } = await (supabase.from('organization_members' as any).select('id', { count: 'exact', head: true }).eq('organization_id', organizationId) as any);
    totalUsers = count ?? 0;
  } else {
    const { count } = await (supabase.from('profiles' as any).select('id', { count: 'exact', head: true }) as any);
    totalUsers = count ?? 0;
  }

  // Orgs count (platform-wide always)
  const { count: totalOrgs } = await (supabase.from('organizations' as any).select('id', { count: 'exact', head: true }) as any);

  // Leads & payments (not org-scoped currently)
  const { count: totalLeads } = await (supabase.from('leads' as any).select('id', { count: 'exact', head: true }) as any);
  const { count: totalPayments } = await (supabase.from('payments' as any).select('id', { count: 'exact', head: true }) as any);

  // Role counts – scoped to org members if not superadmin
  let roleCounts: Record<string, number> = {};
  if (scoped) {
    const { data: members } = await (supabase.from('organization_members' as any).select('user_id').eq('organization_id', organizationId) as any);
    const memberIds = (members ?? []).map((m: any) => m.user_id);
    if (memberIds.length > 0) {
      const { data: roles } = await (supabase.from('user_roles' as any).select('role').in('user_id', memberIds) as any);
      for (const r of roles ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
    }
  } else {
    const { data: roles } = await (supabase.from('user_roles' as any).select('role') as any);
    for (const r of roles ?? []) roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
  }

  return {
    totalUsers: totalUsers ?? 0,
    totalCourses: totalCourses ?? 0,
    totalBatches: totalBatches ?? 0,
    totalOrgs: totalOrgs ?? 0,
    totalLeads: totalLeads ?? 0,
    totalPayments: totalPayments ?? 0,
    roleCounts,
  };
}

// ===== USERS =====
async function listUsers() {
  const { data: profilesData } = await (supabase.from('profiles' as any).select('*').order('created_at', { ascending: false }) as any);
  const { data: rolesData } = await (supabase.from('user_roles' as any).select('user_id, role') as any);
  const roleMap: Record<string, string> = {};
  for (const r of rolesData ?? []) roleMap[r.user_id] = r.role;
  return (profilesData ?? []).map((p: any) => ({ ...p, role: roleMap[p.user_id] || 'student' }));
}

async function updateUser(params: any) {
  const { user_id, display_name } = params;
  const { error } = await (supabase.from('profiles' as any).update({ display_name }).eq('user_id', user_id) as any);
  if (error) throw error;
  return { success: true };
}

async function deleteUser(params: any) {
  const { user_id } = params;
  await (supabase.from('profiles' as any).delete().eq('user_id', user_id) as any);
  await (supabase.from('user_roles' as any).delete().eq('user_id', user_id) as any);
  return { success: true };
}

async function changeRole(params: any) {
  const { user_id, role } = params;
  const { data: existing } = await (supabase.from('user_roles' as any).select('id').eq('user_id', user_id).maybeSingle() as any);
  if (existing) {
    await (supabase.from('user_roles' as any).update({ role }).eq('user_id', user_id) as any);
  } else {
    await (supabase.from('user_roles' as any).insert({ user_id, role }) as any);
  }
  return { success: true };
}

// ===== ORGANIZATIONS =====
async function listOrganizations() {
  const { data: orgs } = await (supabase.from('organizations' as any).select('*').order('created_at', { ascending: false }) as any);
  const { data: members } = await (supabase.from('organization_members' as any).select('organization_id') as any);
  const countMap: Record<string, number> = {};
  for (const m of members ?? []) countMap[m.organization_id] = (countMap[m.organization_id] || 0) + 1;
  return (orgs ?? []).map((o: any) => ({ ...o, member_count: countMap[o.id] || 0 }));
}

async function createOrganization(params: any) {
  const { name, slug } = params;
  const { data, error } = await (supabase.from('organizations' as any).insert({ name, slug }).select().single() as any);
  if (error) throw error;
  return data;
}

async function deleteOrganization(params: any) {
  const { id } = params;
  await (supabase.from('organization_members' as any).delete().eq('organization_id', id) as any);
  const { error } = await (supabase.from('organizations' as any).delete().eq('id', id) as any);
  if (error) throw error;
  return { success: true };
}

async function listOrgMembers(params: any) {
  const { organization_id } = params;
  const { data: members } = await (supabase.from('organization_members' as any).select('*').eq('organization_id', organization_id) as any);
  const userIds = (members ?? []).map((m: any) => m.user_id);
  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', userIds) as any);
    profiles = data ?? [];
  }
  const profileMap: Record<string, any> = {};
  for (const p of profiles) profileMap[p.user_id] = p;
  return (members ?? []).map((m: any) => ({ ...m, profile: profileMap[m.user_id] || null }));
}

async function addOrgMember(params: any) {
  const { organization_id, user_id } = params;
  const { error } = await (supabase.from('organization_members' as any).insert({ organization_id, user_id }) as any);
  if (error) throw error;
  return { success: true };
}

async function removeOrgMember(params: any) {
  const { organization_id, user_id } = params;
  const { error } = await (supabase.from('organization_members' as any).delete().eq('organization_id', organization_id).eq('user_id', user_id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== LEADS =====
async function listLeads() {
  const { data, error } = await (supabase.from('leads' as any).select('*').order('created_at', { ascending: false }) as any);
  if (error) throw error;
  return data ?? [];
}

async function createLead(params: any) {
  const { data, error } = await (supabase.from('leads' as any).insert(params).select().single() as any);
  if (error) throw error;
  return data;
}

async function updateLead(params: any) {
  const { id, ...updates } = params;
  const { error } = await (supabase.from('leads' as any).update(updates).eq('id', id) as any);
  if (error) throw error;
  return { success: true };
}

async function deleteLead(params: any) {
  const { error } = await (supabase.from('leads' as any).delete().eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== ENROLLMENTS =====
async function listEnrollments() {
  const { data: enrollments } = await (supabase.from('batch_students' as any).select('*').order('enrolled_at', { ascending: false }) as any);
  const studentIds = [...new Set((enrollments ?? []).map((e: any) => e.student_id))];
  const batchIds = [...new Set((enrollments ?? []).map((e: any) => e.batch_id))];
  let profiles: any[] = [];
  let batches: any[] = [];
  if (studentIds.length) {
    const { data } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', studentIds) as any);
    profiles = data ?? [];
  }
  if (batchIds.length) {
    const { data } = await (supabase.from('batches' as any).select('id, name, course_id, courses(name)').in('id', batchIds) as any);
    batches = data ?? [];
  }
  const pMap: Record<string, any> = {};
  for (const p of profiles) pMap[p.user_id] = p;
  const bMap: Record<string, any> = {};
  for (const b of batches) bMap[b.id] = b;
  return (enrollments ?? []).map((e: any) => ({
    ...e,
    student_profile: pMap[e.student_id] || null,
    batch: bMap[e.batch_id] || null,
  }));
}

// ===== SCHEDULES =====
async function listSchedules(params: any) {
  let query = supabase.from('schedules' as any).select('*, batches(name, courses(name))').order('day_of_week').order('start_time') as any;
  if (params?.batch_id) query = query.eq('batch_id', params.batch_id);
  const { data } = await query;
  return data ?? [];
}

async function createSchedule(params: any) {
  const { data, error } = await (supabase.from('schedules' as any).insert(params).select().single() as any);
  if (error) throw error;
  return data;
}

async function updateSchedule(params: any) {
  const { id, ...updates } = params;
  const { error } = await (supabase.from('schedules' as any).update(updates).eq('id', id) as any);
  if (error) throw error;
  return { success: true };
}

async function deleteSchedule(params: any) {
  const { error } = await (supabase.from('schedules' as any).delete().eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== ATTENDANCE =====
async function listAttendance(params: any) {
  let query = supabase.from('attendance' as any).select('*').order('date', { ascending: false }) as any;
  if (params?.batch_id) query = query.eq('batch_id', params.batch_id);
  if (params?.date) query = query.eq('date', params.date);
  const { data } = await query;
  const sIds = [...new Set((data ?? []).map((a: any) => a.student_id))];
  let profs: any[] = [];
  if (sIds.length) {
    const { data: p } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', sIds) as any);
    profs = p ?? [];
  }
  const pm: Record<string, any> = {};
  for (const p of profs) pm[p.user_id] = p;
  return (data ?? []).map((a: any) => ({ ...a, student_profile: pm[a.student_id] || null }));
}

async function saveAttendance(params: any) {
  const { batch_id, date, records } = params;
  await (supabase.from('attendance' as any).delete().eq('batch_id', batch_id).eq('date', date) as any);
  if (records.length > 0) {
    const rows = records.map((r: any) => ({ batch_id, date, student_id: r.student_id, status: r.status }));
    const { error } = await (supabase.from('attendance' as any).insert(rows) as any);
    if (error) throw error;
  }
  return { success: true };
}

// ===== LIVE CLASSES =====
async function listLiveClasses() {
  const { data } = await (supabase.from('live_classes' as any).select('*, batches(name)').order('scheduled_at', { ascending: false }) as any);
  return data ?? [];
}

async function createLiveClass(params: any) {
  const { data, error } = await (supabase.from('live_classes' as any).insert(params).select().single() as any);
  if (error) throw error;
  return data;
}

async function updateLiveClass(params: any) {
  const { id, ...updates } = params;
  const { error } = await (supabase.from('live_classes' as any).update(updates).eq('id', id) as any);
  if (error) throw error;
  return { success: true };
}

async function deleteLiveClass(params: any) {
  const { error } = await (supabase.from('live_classes' as any).delete().eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== MATERIALS =====
async function listMaterials(params: any) {
  let query = supabase.from('materials' as any).select('*, courses(name)').order('created_at', { ascending: false }) as any;
  if (params?.course_id) query = query.eq('course_id', params.course_id);
  const { data } = await query;
  return data ?? [];
}

async function createMaterial(params: any) {
  const { data, error } = await (supabase.from('materials' as any).insert(params).select().single() as any);
  if (error) throw error;
  return data;
}

async function deleteMaterial(params: any) {
  const { error } = await (supabase.from('materials' as any).delete().eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== PAYMENTS =====
async function listPayments() {
  const { data } = await (supabase.from('payments' as any).select('*').order('created_at', { ascending: false }) as any);
  const sIds = [...new Set((data ?? []).map((p: any) => p.student_id))];
  let profs: any[] = [];
  if (sIds.length) {
    const { data: p } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', sIds) as any);
    profs = p ?? [];
  }
  const pm: Record<string, any> = {};
  for (const p of profs) pm[p.user_id] = p;
  return (data ?? []).map((p: any) => ({ ...p, student_profile: pm[p.student_id] || null }));
}

async function createPayment(params: any) {
  const { data, error } = await (supabase.from('payments' as any).insert(params).select().single() as any);
  if (error) throw error;
  return data;
}

async function updatePayment(params: any) {
  const { id, ...updates } = params;
  const { error } = await (supabase.from('payments' as any).update(updates).eq('id', id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== PAYROLL =====
async function listPayroll() {
  const { data } = await (supabase.from('payroll' as any).select('*').order('year', { ascending: false }).order('month', { ascending: false }) as any);
  const tIds = [...new Set((data ?? []).map((p: any) => p.teacher_id))];
  let profs: any[] = [];
  if (tIds.length) {
    const { data: p } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', tIds) as any);
    profs = p ?? [];
  }
  const pm: Record<string, any> = {};
  for (const p of profs) pm[p.user_id] = p;
  return (data ?? []).map((p: any) => ({ ...p, teacher_profile: pm[p.teacher_id] || null }));
}

async function createPayroll(params: any) {
  const { data, error } = await (supabase.from('payroll' as any).insert(params).select().single() as any);
  if (error) throw error;
  return data;
}

async function updatePayroll(params: any) {
  const { id, ...updates } = params;
  const { error } = await (supabase.from('payroll' as any).update(updates).eq('id', id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== NOTIFICATIONS =====
async function listNotifications() {
  const { data } = await (supabase.from('notifications').select('*').order('created_at', { ascending: false }) as any);
  return data ?? [];
}

async function createNotification(params: any) {
  const { data, error } = await (supabase.from('notifications').insert(params).select().single() as any);
  if (error) throw error;
  return data;
}

async function markRead(params: any) {
  const { error } = await (supabase.from('notifications').update({ read: true }).eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

async function deleteNotification(params: any) {
  const { error } = await (supabase.from('notifications').delete().eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== STUDENTS =====
async function listStudentsWithBatches() {
  const { data: roles } = await (supabase.from('user_roles' as any).select('user_id').eq('role', 'student') as any);
  const studentIds = (roles ?? []).map((r: any) => r.user_id);
  if (studentIds.length === 0) return [];
  const { data: profiles } = await (supabase.from('profiles' as any).select('*').in('user_id', studentIds) as any);
  const { data: enrollments } = await (supabase.from('batch_students' as any).select('student_id, batch_id, batches(name, courses(name))').in('student_id', studentIds) as any);
  const enrollMap: Record<string, any[]> = {};
  for (const e of enrollments ?? []) {
    if (!enrollMap[e.student_id]) enrollMap[e.student_id] = [];
    enrollMap[e.student_id].push(e);
  }
  return (profiles ?? []).map((p: any) => ({ ...p, enrollments: enrollMap[p.user_id] || [] }));
}

async function listTeachers() {
  const { data: roles } = await (supabase.from('user_roles' as any).select('user_id').eq('role', 'teacher') as any);
  if (!roles?.length) return [];
  const ids = roles.map((r: any) => r.user_id);
  const { data: profiles } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', ids) as any);
  return profiles ?? [];
}

async function listAllStudents() {
  const { data: roles } = await (supabase.from('user_roles' as any).select('user_id').eq('role', 'student') as any);
  if (!roles?.length) return [];
  const ids = roles.map((r: any) => r.user_id);
  const { data: profiles } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', ids) as any);
  return profiles ?? [];
}

// ===== COURSES =====
async function listCourses() {
  const { data, error } = await (supabase.from('courses' as any).select('*').order('created_at', { ascending: false }) as any);
  if (error) throw error;
  return data ?? [];
}

async function createCourse(params: any) {
  const { name, description, created_by } = params;
  const { data, error } = await (supabase.from('courses' as any).insert({ name, description, created_by }).select().single() as any);
  if (error) throw error;
  return data;
}

async function deleteCourse(params: any) {
  const { error } = await (supabase.from('courses' as any).delete().eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

// ===== BATCHES =====
async function listBatches(params: any) {
  let query = supabase.from('batches' as any).select('*, courses(name)') as any;
  if (params?.course_id) query = query.eq('course_id', params.course_id);
  const { data } = await query.order('created_at', { ascending: false });
  return data ?? [];
}

async function createBatch(params: any) {
  const { course_id, name, max_students } = params;
  const { data, error } = await (supabase.from('batches' as any).insert({ course_id, name, max_students: max_students ?? 25 }).select().single() as any);
  if (error) throw error;
  return data;
}

async function updateBatch(params: any) {
  const { id, ...updates } = params;
  const { error } = await (supabase.from('batches' as any).update(updates).eq('id', id) as any);
  if (error) throw error;
  return { success: true };
}

async function deleteBatch(params: any) {
  await (supabase.from('batch_students' as any).delete().eq('batch_id', params.id) as any);
  const { error } = await (supabase.from('batches' as any).delete().eq('id', params.id) as any);
  if (error) throw error;
  return { success: true };
}

async function listBatchStudents(params: any) {
  const { data } = await (supabase.from('batch_students' as any).select('*').eq('batch_id', params.batch_id) as any);
  const sIds = (data ?? []).map((d: any) => d.student_id);
  let profs: any[] = [];
  if (sIds.length) {
    const { data: p } = await (supabase.from('profiles' as any).select('user_id, display_name, email').in('user_id', sIds) as any);
    profs = p ?? [];
  }
  const pm: Record<string, any> = {};
  for (const p of profs) pm[p.user_id] = p;
  return (data ?? []).map((d: any) => ({ ...d, profile: pm[d.student_id] || null }));
}

async function addBatchStudent(params: any) {
  const { error } = await (supabase.from('batch_students' as any).insert({ batch_id: params.batch_id, student_id: params.student_id }) as any);
  if (error) throw error;
  return { success: true };
}

async function removeBatchStudent(params: any) {
  const { error } = await (supabase.from('batch_students' as any).delete().eq('batch_id', params.batch_id).eq('student_id', params.student_id) as any);
  if (error) throw error;
  return { success: true };
}

async function batchStudentCount(params: any) {
  const { count, error } = await (supabase.from('batch_students' as any).select('id', { count: 'exact', head: true }).eq('batch_id', params.batch_id) as any);
  if (error) throw error;
  return count ?? 0;
}

async function edgeFunctionAction(action: string, params: any) {
  const { data, error } = await supabase.functions.invoke('admin-query', {
    body: { action, params },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
