# MRS Production Owner Setup Guide

- **Repository:** `/Users/macbook/Documents/mangal royal studio/mangalroyalstudio-clean`
- **Date:** 2026-11-22
- **Classification:** `OWNER ACTION REQUIRED` (at provisioning time)

---

## 1. Security Requirements

- **No default passwords** and **no reuse** of any development or staging password.
- **No credentials in source code, `.env.example`, reports, logs, or shell history.**
- **Salted scrypt hashing** via `hashPassword()` in `services/api/src/store/data-store.ts`.
- **Correct role:** `OWNER` (with `isActive: true`).
- **Public registration blocked:** Public customer registration endpoints (`/api/customer/register`) only create `Customer` records and cannot create `AdminUser` or privileged roles.
- **Session revocation:** Verified via `POST /api/auth/logout` and `token-revocation.ts` (revoked tokens rejected with `401`).

---

## 2. One-Time Production Owner Account Provisioning Procedure

Run this on the production VPS inside the `mrs_prod_api` container (or via a one-time Node/TSX script) reading the password from **interactive hidden stdin** (`readline` / `stty -echo`) so the password never enters `bash`/`zsh` history, process arguments (`ps`), or log files.

### Step 1 — Ensure `OWNER` Role & Permissions Exist
Verify `Role` (`OWNER`, `MANAGER`, `PRICING_OPERATOR`) and `Permission` rows are seeded in `mangal_royal_studio_prod` (without creating any default admin users).

### Step 2 — Interactive One-Time Provisioning (No Shell History)
1. Connect via SSH to the production host (private key only).
2. Run an interactive one-time script inside `mrs_prod_api` that:
   - Prompts for the Owner email (e.g., `owner@mangalroyalstudio.com`) and reads the password twice from `/dev/tty` with echo disabled.
   - Enforces minimum length `>= 16` characters and rejects known placeholder strings.
   - Hashes the password with `hashPassword(password)` (salted `scrypt`).
   - Upserts the `AdminUser` row bound to the `OWNER` `roleId` with `isActive: true`.
   - Clears the password buffer from memory and exits without printing the password.

### Step 3 — Verification Checklist (Post-Provisioning)
1. **SSH Tunnel Only:** Open an SSH port-forward to `127.0.0.1:3001` (Admin) and `127.0.0.1:4000` (API). Never expose Admin publicly.
2. **Owner Login:** Sign in via Admin UI (`POST /api/auth/login`), verify `200 OK`, `HttpOnly` cookie, and `user.role === 'OWNER'`.
3. **Session Revocation:** Copy the session token/cookie, call `POST /api/auth/logout`, and confirm subsequent `GET /api/auth/me` with the copied token returns `401`.
4. **Least Privilege Check:** Verify no default/seed admin accounts exist with active passwords in `AdminUser`.
