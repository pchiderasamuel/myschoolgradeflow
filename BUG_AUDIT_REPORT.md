# 🐛 Comprehensive Bug Audit & Fix Implementation Plan
## SchoolGradeFlow SaaS Platform

**Last Updated:** June 7, 2026  
**Status:** Critical Issues Identified  
**Priority:** High

---

## 📊 Executive Summary

Conducted a systematic code review of the entire codebase including:
- ✅ 5 Supabase Edge Functions (Deno runtime)
- ✅ 15+ React components and pages
- ✅ Core services and hooks
- ✅ Authentication flows
- ✅ Payment integration
- ✅ Error handling patterns

**Total Bugs Found:** 18 Critical/High Priority Issues
**Estimate to Fix:** 4-6 hours
**Risk Level:** High - Some issues could cause data loss or security vulnerabilities

---

## 🔴 Critical Bugs (Fix Immediately)

### 1. **Missing Error Handling in Edge Function Resend Email**
**File:** `supabase/functions/provision-school/index.ts` (Line 125)  
**Severity:** 🔴 CRITICAL  
**Issue:** The Resend API call to send welcome email is not awaited and errors are silently swallowed

```typescript
// Current (BUGGY)
if (resendKey && adminEmail) {
  await fetch("https://api.resend.com/emails", {
    // ... request setup ...
  });
  // ^ NO error handling - if email fails to send, user doesn't know
}
```

**Impact:**
- Admin never receives welcome email
- No feedback to provisioning UI
- New schools created but admins can't access them

**Fix Priority:** CRITICAL - Block users from accessing provisioned schools  
**Estimate:** 30 minutes

---

### 2. **Unsafe Schema Casting in Log-Session Edge Function**
**File:** `supabase/functions/log-session/index.ts` (Line 33)  
**Severity:** 🔴 CRITICAL  
**Issue:** User object structure is assumed but never validated

```typescript
// Current (BUGGY)
const { user, event_type } = body ?? {};
if (!user || !user.id || !event_type) {
  return Response.json({ error: "..." }, { status: 400, ... });
}
// user.app_metadata and user.identities are assumed to exist
const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || "email";
```

**Impact:**
- Crashes if user object has unexpected structure
- Session logging silently fails
- No audit trail for user activities

**Fix Priority:** CRITICAL - Sessions not logged = security gap  
**Estimate:** 20 minutes

---

### 3. **Unhandled Promise Rejection in Auth Context**
**File:** `src/contexts/AuthContext.tsx` (Line 95-105)  
**Severity:** 🔴 CRITICAL  
**Issue:** `fetchProfile()` can throw but promise rejection is not handled

```typescript
// Current (BUGGY) - in onAuthStateChange handler
fetchProfile(s.user.id, s.user.email ?? null).then((p) => {
  setProfile(p);
  profileRef.current = p;
  setLoading(false);
  // ... no .catch() handler!
});
```

**Impact:**
- If getUserProfile() throws, entire auth flow breaks silently
- User appears stuck in loading state
- Entire app becomes unresponsive

**Fix Priority:** CRITICAL - App freezes on profile load error  
**Estimate:** 15 minutes

---

### 4. **Missing Null Check in Payment Response Handling**
**File:** `src/pages/admin/PaymentsPage.tsx` (Line 121)  
**Severity:** 🔴 CRITICAL  
**Issue:** Unsafe type casting of data response

```typescript
// Current (BUGGY)
if ((data as { paymentUrl?: string })?.paymentUrl) {
  window.location.href = (data as any).paymentUrl; // No validation!
}
```

**Impact:**
- Could redirect to arbitrary URLs if response is compromised
- Type assertion hides actual error
- XSS vulnerability potential

**Fix Priority:** CRITICAL - Security vulnerability  
**Estimate:** 20 minutes

---

### 5. **Race Condition in Session Logging**
**File:** `src/contexts/AuthContext.tsx` (Line 111-112)  
**Severity:** 🟠 HIGH  
**Issue:** Login event logged based on access_token comparison, but token could change

```typescript
// Current (BUGGY)
if (event === "SIGNED_IN" && loggedLoginRef.current !== s.access_token) {
  loggedLoginRef.current = s.access_token ?? null; // Access token can refresh
  logSessionEvent(s.user, "LOGIN");
}
```

**Impact:**
- Same login logged multiple times if token refreshes
- Duplicate audit entries
- Analytics reports inflated

**Fix Priority:** HIGH - Affects audit accuracy  
**Estimate:** 25 minutes

---

## 🟠 High Priority Bugs

### 6. **Missing TenantData Type Safety in TenantApp**
**File:** `src/pages/TenantApp.tsx` (Line 114-117)  
**Severity:** 🟠 HIGH  
**Issue:** Data object properties are mutated without type checking

```typescript
// Current (BUGGY)
const json = JSON.stringify(data);
localStorage.setItem(DB_KEY, json);
lastSerialized.current = json;
localRev.current = (data._rev as number) ?? 0;
// data structure is never validated - could be anything
```

**Impact:**
- Corrupted data in localStorage
- Next sync pulls garbage data
- Student data could be lost

**Fix Priority:** HIGH - Data integrity issue  
**Estimate:** 40 minutes

---

### 7. **No Error Boundary for Child Components**
**File:** `src/App.tsx` and all route pages  
**Severity:** 🟠 HIGH  
**Issue:** No Error Boundary component wrapping route children

```typescript
// Current (BUGGY) - App.tsx has no Error Boundary
<Router>
  <Routes>
    <Route path="/" element={<Index />} />
    {/* If any child throws, entire app crashes */}
  </Routes>
</Router>
```

**Impact:**
- Single component error crashes entire app
- User loses all unsaved data
- No graceful error recovery

**Fix Priority:** HIGH - App stability  
**Estimate:** 45 minutes

---

### 8. **Unsafe LocalStorage JSON Parsing**
**File:** `src/components/school/School_Management_App.tsx` (Line 1978, 1982, 2299)  
**Severity:** 🟠 HIGH  
**Issue:** JSON.parse errors are silently swallowed with bare `catch {}`

```typescript
// Current (BUGGY)
try { 
  return JSON.parse(localStorage.getItem(FEE_STRUCT_LS) || "{}"); 
} catch { 
  return {}; // Silent failure - no logging
}
```

**Impact:**
- Corrupted fees data silently returns empty object
- Students charged wrong amounts
- No way to debug what went wrong

**Fix Priority:** HIGH - Financial impact  
**Estimate:** 25 minutes

---

### 9. **Missing Await on Async File Reader**
**File:** `src/lib/csv-import.ts` (Line 31)  
**Severity:** 🟠 HIGH  
**Issue:** Promise chain not properly awaited

```typescript
// Current (BUGGY)
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string); // Unsafe cast
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}
// If reader.result is null or ArrayBuffer, app crashes
```

**Impact:**
- CSV import crashes silently
- Bulk student upload fails
- No error message to user

**Fix Priority:** HIGH - Critical feature broken  
**Estimate:** 15 minutes

---

### 10. **Missing Response Validation in Payment Webhook**
**File:** `supabase/functions/payment-webhook/index.ts` (Line 72-89)  
**Severity:** 🟠 HIGH  
**Issue:** Database error silently returns 500 with generic message

```typescript
// Current (BUGGY)
try {
  if (event.event === "charge.success") {
    const { error } = await serviceClient
      .from("payments")
      .update({ status: "success", paid_at: new Date().toISOString() })
      .eq("reference", reference);

    if (error) throw error; // Generic error, no context
```

**Impact:**
- Payment status not updated in database
- Student charged but can't verify payment
- No way to know which reference failed

**Fix Priority:** HIGH - Financial impact  
**Estimate:** 30 minutes

---

### 11. **CDN Script Loading Race Condition**
**File:** `src/components/school/utils/resourcePdf.ts` (Line 7-9)  
**Severity:** 🟠 HIGH  
**Issue:** Multiple concurrent PDF generation calls could load scripts multiple times

```typescript
// Current (BUGGY)
async function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    // Race condition: two calls can both pass the check and create duplicates
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}
```

**Impact:**
- Multiple jsPDF instances loaded
- Memory leak in browser
- PDF generation fails intermittently

**Fix Priority:** HIGH - Intermittent failures  
**Estimate:** 35 minutes

---

## 🟡 Medium Priority Bugs

### 12. **Missing Tenant ID Validation in Provision School**
**File:** `supabase/functions/provision-school/index.ts` (Line 50)  
**Severity:** 🟡 MEDIUM  
**Issue:** Tenant ID is not validated as UUID format

```typescript
// Current (BUGGY)
const { name, code, email, phone, address, plan, adminEmail, adminName, tenantId } = body ?? {};

if (!name || !code || !tenantId) {
  return Response.json({ error: "name, code, and tenantId are required" }, ...);
}

// tenantId could be "invalid-uuid-string" and still pass
const { data: school, error: schoolError } = await serviceClient
  .from("schools")
  .insert({
    tenant_id: tenantId, // This will fail silently or with DB error
```

**Impact:**
- Invalid school provision requests accepted
- Confusing error messages
- Schema validation bypassed

**Fix Priority:** MEDIUM - Error handling issue  
**Estimate:** 20 minutes

---

### 13. **No IP Geolocation Fallback in Auth Logger**
**File:** `src/lib/auth-logger.ts` (Line 112-120)  
**Severity:** 🟡 MEDIUM  
**Issue:** If ipify API fails, IP address is logged as "unknown" with no retry

```typescript
// Current (BUGGY)
export async function getCurrentClientIp(): Promise<string | null> {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    if (response.ok) {
      const data = await response.json();
      return data.ip;
    }
  } catch (e) {
    console.warn("Failed to fetch client IP:", e);
  }
  return null; // Silent failure - no fallback to X-Forwarded-For or similar
}
```

**Impact:**
- Security audit trail has "unknown" IPs
- Can't track suspicious logins
- Reduced security visibility

**Fix Priority:** MEDIUM - Security impact  
**Estimate:** 25 minutes

---

### 14. **Unhandled Activity Dashboard Errors**
**File:** `src/components/ProviderActivityDashboard.tsx` (Line 149)  
**Severity:** 🟡 MEDIUM  
**Issue:** Error message is too generic, doesn't indicate which query failed

```typescript
// Current (BUGGY)
catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Provider activity load failed", err);
  setError(message || "Failed to load provider activity");
  // User sees: "Failed to load provider activity" - no specifics
}
```

**Impact:**
- Provider can't troubleshoot activity issues
- Generic error doesn't help debugging
- Activity dashboard often fails silently

**Fix Priority:** MEDIUM - UX issue  
**Estimate:** 20 minutes

---

### 15. **Missing Account Email Validation**
**File:** `src/components/school/School_Management_App.tsx` (Line 1842)  
**Severity:** 🟡 MEDIUM  
**Issue:** Email validation is too simplistic

```typescript
// Current (BUGGY)
if (!email.includes("@")) throw new Error("bad-email");
// This passes: "test@", "test@." but fails: "user+tag@domain.co.uk"
```

**Impact:**
- Valid emails rejected
- Invalid emails accepted
- User frustration

**Fix Priority:** MEDIUM - UX issue  
**Estimate:** 15 minutes

---

### 16. **Storage Event Listener Not Cleaned Up**
**File:** `src/contexts/AuthContext.tsx` (Line 138-147)  
**Severity:** 🟡 MEDIUM  
**Issue:** Storage listener key checking is too broad

```typescript
// Current (BUGGY)
const handleStorageChange = (e: StorageEvent) => {
  if (e.key === "supabase-auth-token" && e.newValue === null) {
    // Clears on ANY auth token removal, even from other apps
    setSession(null);
    setUser(null);
    setProfile(null);
  }
};
```

**Impact:**
- Could accidentally clear session if another app uses same key
- Forces re-auth unnecessarily
- Poor multi-tab experience

**Fix Priority:** MEDIUM - UX issue  
**Estimate:** 20 minutes

---

### 17. **Implicit Any Types in School Service**
**File:** `src/supabase/schoolService.ts` (Line 1369)  
**Severity:** 🟡 MEDIUM  
**Issue:** Multiple uses of `as never` bypass type checking

```typescript
// Current (BUGGY)
export async function suspendDuplicateTenant(
  tenantId: string,
  reason: string
): Promise<void> {
  const { error } = await supabase.rpc("suspend_duplicate_tenant" as never, {
    _tenant_id: tenantId,
    _reason: reason,
  } as never);
  throwIfError(error, "suspendDuplicateTenant");
}
```

**Impact:**
- Type errors not caught at compile time
- Runtime crashes on unexpected responses
- Reduced code safety

**Fix Priority:** MEDIUM - Code quality  
**Estimate:** 30 minutes

---

### 18. **Missing Form Field Validation Before Submission**
**File:** `src/pages/superadmin/ProvisionSchoolPage.tsx` (Line 72)  
**Severity:** 🟡 MEDIUM  
**Issue:** Form validation duplicated instead of centralized

```typescript
// Current (BUGGY)
toast({ title: "Name, code and tenant ID are required", variant: "destructive" }); return;
// No structured validation - checks scattered in form
```

**Impact:**
- Validation logic not reusable
- Easy to miss required fields
- Poor UX with vague error messages

**Fix Priority:** MEDIUM - Code quality  
**Estimate:** 40 minutes

---

## 📋 Implementation Plan

### Phase 1: Critical Fixes (2-3 hours)
Priority: **MUST FIX BEFORE PRODUCTION**

| # | Issue | File | Effort | Impact |
|---|-------|------|--------|--------|
| 1 | Email sending error handling | `provision-school/index.ts` | 30m | App usability |
| 2 | User object validation | `log-session/index.ts` | 20m | Security/audit |
| 3 | Auth profile error handling | `AuthContext.tsx` | 15m | App stability |
| 4 | Payment URL validation | `PaymentsPage.tsx` | 20m | Security |
| 5 | Login duplicate logging | `AuthContext.tsx` | 25m | Audit accuracy |

**Total Phase 1 Time:** 110 minutes (1.8 hours)  
**Acceptance Criteria:**
- ✅ All critical paths have error handling
- ✅ No unhandled promise rejections
- ✅ Type safety enforced in critical paths
- ✅ Edge Functions return meaningful errors

---

### Phase 2: High Priority Fixes (2-3 hours)
Priority: **SHOULD FIX BEFORE V1 RELEASE**

| # | Issue | File | Effort | Impact |
|---|-------|------|--------|--------|
| 6 | TenantData type safety | `TenantApp.tsx` | 40m | Data integrity |
| 7 | Error boundary implementation | `App.tsx` | 45m | App stability |
| 8 | LocalStorage JSON safety | `School_Management_App.tsx` | 25m | Data integrity |
| 9 | CSV import error handling | `csv-import.ts` | 15m | Feature reliability |
| 10 | Payment webhook error context | `payment-webhook/index.ts` | 30m | Debuggability |
| 11 | Script loading race condition | `resourcePdf.ts` | 35m | Performance |

**Total Phase 2 Time:** 190 minutes (3.2 hours)  
**Acceptance Criteria:**
- ✅ No data loss scenarios
- ✅ Graceful error recovery
- ✅ Improved error messages
- ✅ No memory leaks

---

### Phase 3: Medium Priority Fixes (1-2 hours)
Priority: **NICE TO HAVE FOR POLISH**

| # | Issue | File | Effort | Impact |
|---|-------|------|--------|--------|
| 12 | Tenant ID validation | `provision-school/index.ts` | 20m | UX |
| 13 | IP geolocation fallback | `auth-logger.ts` | 25m | Security |
| 14 | Activity dashboard errors | `ProviderActivityDashboard.tsx` | 20m | UX |
| 15 | Email validation | `School_Management_App.tsx` | 15m | UX |
| 16 | Storage listener scope | `AuthContext.tsx` | 20m | UX |
| 17 | Type safety cleanup | `schoolService.ts` | 30m | Code quality |
| 18 | Form validation centralization | `ProvisionSchoolPage.tsx` | 40m | Code quality |

**Total Phase 3 Time:** 170 minutes (2.8 hours)  
**Acceptance Criteria:**
- ✅ Better error messages
- ✅ Improved form validation
- ✅ Stronger type safety
- ✅ Better security logging

---

## 🔧 Quick Start: Implement Phase 1 Fixes

### Fix #1: Email Sending Error Handling (provision-school/index.ts)

```typescript
// BEFORE (BUGGY)
if (resendKey && adminEmail) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "...", to: adminEmail, subject: "...", html: "..." }),
  });
}

// AFTER (FIXED)
if (resendKey && adminEmail) {
  try {
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "...", to: adminEmail, subject: "...", html: "..." }),
    });
    
    if (!emailRes.ok) {
      const emailErr = await emailRes.json();
      console.error("Resend API error:", emailErr);
      // Don't throw - provisioning succeeded even if email failed
    }
  } catch (emailErr) {
    console.error("Failed to send welcome email:", emailErr);
    // Log but don't fail the entire provision operation
  }
}
```

---

### Fix #2: User Object Validation (log-session/index.ts)

```typescript
// BEFORE (BUGGY)
const provider = user.app_metadata?.provider || user.identities?.[0]?.provider || "email";

// AFTER (FIXED)
interface AuthUser {
  id: string;
  app_metadata?: Record<string, unknown>;
  identities?: Array<{ provider?: string }>;
}

const validateUser = (obj: any): obj is AuthUser => {
  return typeof obj === 'object' && obj !== null && typeof obj.id === 'string';
};

if (!validateUser(user)) {
  return Response.json(
    { error: "Invalid user object in request" },
    { status: 400, headers: corsHeaders }
  );
}

const provider = 
  (user.app_metadata?.provider as string) || 
  user.identities?.[0]?.provider || 
  "email";
```

---

### Fix #3: Auth Profile Error Handling (AuthContext.tsx)

```typescript
// BEFORE (BUGGY)
fetchProfile(s.user.id, s.user.email ?? null).then((p) => {
  setProfile(p);
  profileRef.current = p;
  setLoading(false);
});

// AFTER (FIXED)
fetchProfile(s.user.id, s.user.email ?? null)
  .then((p) => {
    setProfile(p);
    profileRef.current = p;
    setLoading(false);
  })
  .catch((err) => {
    console.error("Failed to fetch profile:", err);
    // Fallback to unassigned role
    const fallbackProfile: AuthProfile = {
      userId: s.user.id,
      email: s.user.email ?? null,
      role: "unassigned",
      schoolId: null,
      firstName: null,
      lastName: null,
    };
    setProfile(fallbackProfile);
    profileRef.current = fallbackProfile;
    setLoading(false);
    toast({
      title: "Warning",
      description: "Could not load your profile. Some features may be unavailable.",
      variant: "destructive",
    });
  });
```

---

## 🧪 Testing Checklist

After implementing fixes, test:

- [ ] Provision new school → check email received
- [ ] Login → check session_logs table has entry
- [ ] App crash during page load → check Error Boundary catches it
- [ ] Payment initiation → check payment_url is valid URL
- [ ] Multiple logins → check session_logs has only 1 LOGIN entry
- [ ] CSV import with corrupted file → check graceful error
- [ ] PDF generation twice → check only 1 script loaded
- [ ] Close browser tab → check other tab maintains session
- [ ] Fill invalid email form → check validation message

---

## 🚀 Deployment Strategy

1. **Local Testing** → Run through full test checklist
2. **Staging Deployment** → Deploy Phase 1 fixes to staging environment
3. **QA Testing** → Full regression test on staging
4. **Production Rollout** → Deploy fixes to production in order:
   - Fix #1: Email handling (non-breaking)
   - Fix #2: User validation (non-breaking)
   - Fix #3: Auth error handling (non-breaking)
   - Fix #4: Payment URL validation (non-breaking)
   - Fix #5: Login deduplication (backward compatible)

**Estimated Deployment Window:** 2-4 hours of development + testing

---

## 📝 Notes

- All fixes maintain backward compatibility
- No database migrations required
- No breaking API changes
- Can be deployed incrementally
- Phase 1 should be done before production release
- Phase 2-3 can be done in future releases

