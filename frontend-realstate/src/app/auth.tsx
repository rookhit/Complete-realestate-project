import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// ─── Auth client ──────────────────────────────────────────────────────────────
// Talks to the backend's /api/v1/auth endpoints (see backend-realstate/API.md).
// The access token lives only in this module's memory (never localStorage). The refresh
// token is an httpOnly cookie the browser sends by itself on /auth/* calls, which is how a
// reload (or the Google redirect) turns back into a logged-in session.

export const API_URL=(import.meta.env.VITE_API_URL as string|undefined) ?? "http://localhost:3000";

export type AuthUser = { id:string; email:string; name:string|null; phone:string; role:"USER"|"ADMIN"; twoFactorEnabled?:boolean };
// Password was right but the account has 2FA: finish with verifyMfa(code, mfaToken).
export type MfaChallenge = { mfaRequired:true; mfaToken:string };
type AuthStatus = "loading" | "authenticated" | "anonymous";

export class ApiError extends Error {
  status:number; code:string; fields?:Record<string,string>;
  constructor(status:number, code:string, message:string, fields?:Record<string,string>) {
    super(message); this.status=status; this.code=code; this.fields=fields;
  }
}

let accessToken:string|null=null;
// One shared refresh at a time: the backend rotates the refresh cookie on every call, so two
// parallel refreshes would race and the loser would be logged out.
let refreshing:Promise<string|null>|null=null;

async function request<T>(path:string, init:RequestInit={}):Promise<T> {
  const headers=new Headers(init.headers);
  if(init.body!==undefined) headers.set("Content-Type","application/json");
  if(accessToken) headers.set("Authorization",`Bearer ${accessToken}`);
  let res:Response;
  try {
    res=await fetch(`${API_URL}/api/v1${path}`,{ ...init, headers, credentials:"include" });
  } catch {
    throw new ApiError(0,"NETWORK","Can't reach the server. Check your connection and try again.");
  }
  if(res.status===204) return undefined as T;
  const data=await res.json().catch(()=>null) as { error?:{ code:string; message:string; fields?:Record<string,string> } }|null;
  if(!res.ok){
    const e=data?.error;
    throw new ApiError(res.status, e?.code ?? "INTERNAL", e?.message ?? "Something went wrong. Please try again.", e?.fields);
  }
  return data as T;
}

async function refreshOnce():Promise<string> {
  try {
    return (await request<{ accessToken:string }>("/auth/refresh",{ method:"POST", body:"{}" })).accessToken;
  } catch(err) {
    // 409: another tab refreshed the same cookie at the same moment and won. The browser now
    // holds that tab's new cookie, so one retry after a short pause succeeds.
    if(!(err instanceof ApiError) || err.status!==409) throw err;
    await new Promise(r=>setTimeout(r,300+Math.random()*300));
    return (await request<{ accessToken:string }>("/auth/refresh",{ method:"POST", body:"{}" })).accessToken;
  }
}

function refreshAccessToken():Promise<string|null> {
  refreshing ??= refreshOnce()
    .then(t=>{ accessToken=t; return accessToken; })
    .catch(()=>{ accessToken=null; return null; })
    .finally(()=>{ refreshing=null; });
  return refreshing;
}

// For any authenticated API call: on a 401 (access token expired) refresh once and retry.
export async function authFetch<T>(path:string, init:RequestInit={}):Promise<T> {
  try {
    return await request<T>(path,init);
  } catch(err) {
    if(!(err instanceof ApiError) || err.status!==401 || path.startsWith("/auth/")) throw err;
    if(!(await refreshAccessToken())) throw err;
    return request<T>(path,init);
  }
}

// ─── React state ──────────────────────────────────────────────────────────────
type RegisterInput = { name:string; email:string; phone:string; password:string; confirmPassword:string };
type AuthContextValue = {
  user:AuthUser|null;
  status:AuthStatus;
  login:(email:string, password:string)=>Promise<AuthUser|MfaChallenge>;
  // mfaToken comes from login(); after a Google redirect it is omitted (the backend keeps it in a cookie).
  verifyMfa:(code:string, mfaToken?:string)=>Promise<AuthUser>;
  register:(input:RegisterInput)=>Promise<AuthUser>;
  logout:()=>Promise<void>;
};

const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({ children }: { children:ReactNode }) {
  const [user,setUser]=useState<AuthUser|null>(null);
  const [status,setStatus]=useState<AuthStatus>("loading");

  // On load: the refresh cookie (if any) survives reloads, so trade it for an access token
  // and fetch the user. This also completes Google sign-in after its redirect.
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const token=await refreshAccessToken();
      const me=token ? await request<{ user:AuthUser }>("/auth/me").catch(()=>null) : null;
      if(cancelled) return;
      setUser(me?.user ?? null);
      setStatus(me ? "authenticated" : "anonymous");
    })();
    return ()=>{ cancelled=true; };
  },[]);

  const signedIn=useCallback((r:{ user:AuthUser; accessToken:string })=>{
    accessToken=r.accessToken; setUser(r.user); setStatus("authenticated"); return r.user;
  },[]);

  const login=useCallback(async(email:string, password:string)=>{
    const r=await request<{ user:AuthUser; accessToken:string }|MfaChallenge>("/auth/login",{ method:"POST", body:JSON.stringify({ email, password }) });
    return "mfaRequired" in r ? r : signedIn(r);
  },[signedIn]);

  const verifyMfa=useCallback(async(code:string, mfaToken?:string)=>signedIn(
    await request<{ user:AuthUser; accessToken:string }>("/auth/login/2fa",{ method:"POST", body:JSON.stringify({ code, mfaToken }) }),
  ),[signedIn]);

  const register=useCallback(async(input:RegisterInput)=>signedIn(
    await request<{ user:AuthUser; accessToken:string }>("/auth/register",{ method:"POST", body:JSON.stringify(input) }),
  ),[signedIn]);

  const logout=useCallback(async()=>{
    // Clear local state even if the server call fails; the cookie is revoked server-side when it succeeds.
    await request<void>("/auth/logout",{ method:"POST", body:"{}" }).catch(()=>undefined);
    accessToken=null; setUser(null); setStatus("anonymous");
  },[]);

  const value=useMemo(()=>({ user, status, login, verifyMfa, register, logout }),[user,status,login,verifyMfa,register,logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth():AuthContextValue {
  const ctx=useContext(AuthContext);
  if(!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
