import type { Account } from "@/types";

/** Conta com as credenciais. Nunca sai pela API: use `contas.publica`. */
export interface StoredAccount extends Account {
  passwordHash: string;
  credentialVersion?: number;
}
