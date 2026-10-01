interface SireRecord {
  submissionType: string; // check_in, check_out
  date: string;
  firstName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  nationality: string;
  birthDate: string;
  gender: string;
  residenceCity: string;
  originCountry: string;
  originCity: string;
  checkIn: string;
  checkOut: string;
  roomNumber: string;
  rntNumber: string;
  hotelName: string;
}

export function generateSireLine(record: SireRecord): string {
  return [
    record.submissionType,
    record.date,
    record.firstName,
    record.lastName,
    record.documentType,
    record.documentNumber,
    record.nationality,
    record.birthDate,
    record.gender ?? '',
    record.residenceCity ?? '',
    record.originCountry ?? '',
    record.originCity ?? '',
    record.checkIn,
    record.checkOut,
    record.roomNumber,
    record.rntNumber ?? '',
    record.hotelName ?? '',
  ].join('|');
}

export function generateSireFile(records: SireRecord[]): string {
  return records.map(generateSireLine).join('\n');
}
