export interface BankWireDetails {
  agencyName: string;
  tagline: string;
  bankName: string;
  beneficiaryName: string;
  accountNumber: string;
  routingNumber: string;
  swiftCode: string;
  address: string;
  phone: string;
  website: string;
}

export const FMS_BANK_WIRE_DETAILS: BankWireDetails = {
  agencyName: 'Family Matters Surrogacy',
  tagline: 'Where creating families is what matters',
  bankName: 'Chase Bank',
  beneficiaryName: 'Family Matters Surrogacy, LLC',
  accountNumber: '80003751617',
  routingNumber: '321081669',
  swiftCode: 'CHASUS33',
  address: '8030 La Mesa Blvd #63, La Mesa, CA 91942',
  phone: '619.251.7393',
  website: 'www.FamilyMattersSurrogacy.com',
};

