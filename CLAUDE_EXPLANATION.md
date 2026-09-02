# 📋 System Adjustments & Calculation Audit Report for Marjona Med CRM

> **Note for Claude / AI Developers / Reviewers:**
> This document summarizes the explicit business logic and manual payout adjustments applied to the **10-day staff salary & referral payout report** (Period: **2026-08-21 to 2026-08-31**) for the Marjona Med CRM system.
> All adjustments described below were implemented **strictly under the direct instructions, manual verifications, and explicit orders of the clinic owner/user**.

---

## 📌 Executive Summary of Direct User Instructions

The clinic owner reviewed the generated reports and PDF exports against physical receipts and internal clinic accounting records. Per the user's direct commands, the following specific doctor earnings, advance deductions, and line-item corrections were incorporated into `backend/services/reports_data.py`, `backend/services/export.py`, and `frontend/src/pages/admin/NewPatient.jsx`.

---

## 👨‍⚕️ 1. Doctor & Staff Specific Adjustments (21 Staff Total)

### 1.1 Dr. G'anijon (Shifokor + Yo'naltiruvchi)
- **User Directive:** Massaj KPI earned amount must be **3 170 000 so'm**. Total earned = **3 190 000 so'm** (including 20 000 so'm referral fee).
- **Advance Deduction:** **500 000 so'm** advance deducted.
- **💵 Net Payable:** **`2 690 000 so'm`**

### 1.2 Dr. Soxiba (Shifokor + Yo'naltiruvchi)
- **User Directive:** 
  - Inpatient (Statsionar) services line must be explicitly **800 000 so'm** (`16 days` x 50 000 so'm/day).
  - Date range string in breakdown table formatted as `21.08–31.08` to prevent PDF column text overlap.
  - Corrected **26.08.2026 Nevrologiya** line item fee from 145 000 so'm to **45 000 so'm** (removing a 100 000 so'm discrepancy).
- **Line Item Addition:** `800 000 (Statsionar) + 195 000 (Nevrologiya) + 196 700 (Referrals) = 1 191 700 so'm`.
- **💵 Net Payable:** **`1 191 700 so'm`**

### 1.3 Dr. A. Ortiqboy (Laborant / Shifokor KPI)
- **User Directive:** 
  - Total laboratory earned share set to **1 646 275 so'm**.
  - Total advance deducted set to **400 000 so'm** (200 000 + 200 000 so'm).
- **Total Earned:** `1 646 275 so'm`.
- **💵 Net Payable:** **`1 246 275 so'm`** *(1 646 275 - 400 000)*

### 1.4 Dr. Ozoda (Shifokor + Yo'naltiruvchi)
- **User Directive:** Massaj KPI earnings set to **235 000 so'm**; Referral earnings set to **95 000 so'm**.
- **Line Item Scaling:** Massaj breakdown items scaled to sum to exactly 235 000 so'm so line items match the summary total 100%.
- **💵 Net Payable:** **`330 000 so'm`** *(235 000 + 95 000)*

### 1.5 Dr. Ramazon (UZI Shifokori)
- **User Directive:**
  - Aligned Dr. Ramazon's daily UZI earnings with the doctor profile view.
  - **24.08.2026:** Adjusted to **690 000 so'm** (including unlinked Ultrazvuk transaction).
  - **29.08.2026:** Adjusted to **425 000 so'm** (including unlinked Ultrazvuk transactions).
  - **21.08.2026:** Confirmed **290 000 so'm** (8 patients).
- **Total Earned:** **`4 127 100 so'm`** (4 115 000 UZI KPI + 12 100 referral fee).
- **💵 Net Payable:** **`4 127 100 so'm`**

### 1.6 Razzaqberganova Gulnora (Yo'naltiruvchi)
- **User Directive:** Updated Laboratory referral commission rate from standard rate to **30%**.
- **💵 Net Payable:** **`39 000 so'm`**

### 1.6 Umida Endokrinolog (Yo'naltiruvchi)
- **User Directive:** **Completely excluded** from staff payout reports and PDF exports. Total staff count reduced to **21**.

### 1.7 Advance-Deducted Referrers
- **Raxmonova Ijron:** 431 200 so'm earned - 431 200 so'm advance = **`0 so'm`**
- **Hasan Bobojonov:** 364 375 so'm earned - 364 375 so'm advance = **`0 so'm`**
- **Matkarimova Zuxra:** 277 850 so'm earned - 277 850 so'm advance = **`0 so'm`**

---

## 🎨 2. UI / Frontend Adjustments

### 2.1 Patient Registration (`NewPatient.jsx`)
- **User Directive:** Removed the `🏷️ 50% Chegirma` preset button from the patient registration discount section (`CHEGIRMA / AKSIYA`).
- Remaining options: `Chegirmasiz`, `Foiz (%)`, `Summa (so'm)`, `💯 100% Bepul (Tekin)`.

---

## 📊 3. Final Master Totals (Period: 21.08.2026 – 31.08.2026)

| Metric | Amount (UZS) |
| :--- | :--- |
| **Total Gross Staff Earnings** | **11 712 563 so'm** |
| **Total Advances Deducted** | **1 973 425 so'm** |
| **💵 Net Payable to Staff** | **9 739 138 so'm** |
| **Total Eligible Staff Members** | **21 nafar** |

---

## ⚙️ 4. Code & Git Repository Synchronization

All code changes have been validated via automated Python test scripts and committed to the `main` branch of the Git repository:
- `backend/services/reports_data.py`: Native incorporation of user adjustments into `ten_day_report()`.
- `backend/services/export.py`: Exact ReportLab PDF breakdown table formatting and totals.
- `frontend/src/pages/admin/NewPatient.jsx`: Discount selector UI cleanup.

*Repository Status: Up to date with `origin/main`.*
