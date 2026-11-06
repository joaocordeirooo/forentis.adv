export function apenasDigitos(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

// Acha CNPJs escritos com máscara ou como 14 dígitos seguidos.
export function extrairCnpjs(valor: unknown): string[] {
  const encontrados = String(valor ?? '').match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g) ?? [];
  return encontrados.map((numero) => numero.replace(/[./-]/g, ''));
}

// Confere os dígitos verificadores.
export function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  for (let tamanho = 12; tamanho <= 13; tamanho++) {
    let peso = tamanho - 7;
    let soma = 0;
    for (let i = 0; i < tamanho; i++) {
      soma += Number(cnpj[i]) * peso--;
      if (peso < 2) peso = 9;
    }
    const resto = soma % 11;
    const digito = resto < 2 ? 0 : 11 - resto;
    if (Number(cnpj[tamanho]) !== digito) return false;
  }
  return true;
}
