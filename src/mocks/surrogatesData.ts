
export const allSurrogates = [
  {
    id: 'SUR-001',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@email.com',
    phone: '+1 (555) 123-4567',
    age: 28,
    location: 'Los Angeles, California',
    status: 'available',
    experience: 'First time',
    joinedDate: '2024-01-15',
    completedJourneys: 0,
    currentJourney: null,
    medicalStatus: 'cleared',
    psychologicalStatus: 'cleared',
    legalStatus: 'cleared',
    compensation: '$45,000',
    preferences: {
      intendedParentsType: 'Any',
      communicationLevel: 'Regular updates',
      location: 'California preferred'
    },
    medicalInfo: {
      height: '5\'6"',
      weight: '135 lbs',
      bloodType: 'O+',
      previousPregnancies: 1,
      complications: 'None'
    }
  },
  {
    id: 'SUR-002',
    name: 'Lisa Rodriguez',
    email: 'lisa.rodriguez@email.com',
    phone: '+1 (555) 345-6789',
    age: 31,
    location: 'Miami, Florida',
    status: 'matched',
    experience: 'Experienced (2 previous)',
    joinedDate: '2024-01-13',
    completedJourneys: 2,
    currentJourney: 'Davis Family',
    medicalStatus: 'cleared',
    psychologicalStatus: 'cleared',
    legalStatus: 'cleared',
    compensation: '$55,000',
    preferences: {
      intendedParentsType: 'Couples preferred',
      communicationLevel: 'Weekly updates',
      location: 'Florida or nearby states'
    },
    medicalInfo: {
      height: '5\'4"',
      weight: '128 lbs',
      bloodType: 'A+',
      previousPregnancies: 3,
      complications: 'None'
    }
  },
  {
    id: 'SUR-003',
    name: 'Jennifer Thompson',
    email: 'jen.thompson@email.com',
    phone: '+1 (555) 678-9012',
    age: 29,
    location: 'Seattle, Washington',
    status: 'available',
    experience: 'First time',
    joinedDate: '2024-01-10',
    completedJourneys: 0,
    currentJourney: null,
    medicalStatus: 'cleared',
    psychologicalStatus: 'pending',
    legalStatus: 'cleared',
    compensation: '$48,000',
    preferences: {
      intendedParentsType: 'Any',
      communicationLevel: 'Monthly updates',
      location: 'West Coast preferred'
    },
    medicalInfo: {
      height: '5\'7"',
      weight: '142 lbs',
      bloodType: 'B+',
      previousPregnancies: 2,
      complications: 'None'
    }
  },
  {
    id: 'SUR-004',
    name: 'Maria Garcia',
    email: 'maria.garcia@email.com',
    phone: '+1 (555) 567-8901',
    age: 26,
    location: 'Phoenix, Arizona',
    status: 'in-process',
    experience: 'First time',
    joinedDate: '2024-01-11',
    completedJourneys: 0,
    currentJourney: null,
    medicalStatus: 'pending',
    psychologicalStatus: 'cleared',
    legalStatus: 'pending',
    compensation: '$42,000',
    preferences: {
      intendedParentsType: 'Couples preferred',
      communicationLevel: 'Regular updates',
      location: 'Southwest region'
    },
    medicalInfo: {
      height: '5\'3"',
      weight: '125 lbs',
      bloodType: 'O-',
      previousPregnancies: 1,
      complications: 'None'
    }
  },
  {
    id: 'SUR-005',
    name: 'Amanda Wilson',
    email: 'amanda.wilson@email.com',
    phone: '+1 (555) 789-0123',
    age: 33,
    location: 'Chicago, Illinois',
    status: 'available',
    experience: 'Experienced (1 previous)',
    joinedDate: '2024-01-08',
    completedJourneys: 1,
    currentJourney: null,
    medicalStatus: 'cleared',
    psychologicalStatus: 'cleared',
    legalStatus: 'cleared',
    compensation: '$52,000',
    preferences: {
      intendedParentsType: 'Any',
      communicationLevel: 'Weekly updates',
      location: 'Midwest preferred'
    },
    medicalInfo: {
      height: '5\'5"',
      weight: '138 lbs',
      bloodType: 'AB+',
      previousPregnancies: 2,
      complications: 'None'
    }
  }
];

export const surrogateStatuses = [
  { value: 'all', label: 'All Surrogates', count: allSurrogates.length },
  { value: 'available', label: 'Available', count: allSurrogates.filter(s => s.status === 'available').length },
  { value: 'matched', label: 'Matched', count: allSurrogates.filter(s => s.status === 'matched').length },
  { value: 'in-process', label: 'In Process', count: allSurrogates.filter(s => s.status === 'in-process').length },
  { value: 'inactive', label: 'Inactive', count: allSurrogates.filter(s => s.status === 'inactive').length }
];
