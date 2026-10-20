export const NOTIFICATIONS_QUEUE = "notifications";

export const SEND_OTP_JOB = "send-otp";
export const SEND_TRANSACTION_ALERT_JOB = "send-transaction-alert";

export interface SendOtpJobPayload {
    to: string;
    code: string;
    purpose: string;
}

export interface SendTransactionAlertJobPayload {
    to: string;
    accountNumber: string;
    type: 'DEBIT' | 'CREDIT';
    amount: string;
    currency: string;
    counterparty: string;
    reference: string;
}