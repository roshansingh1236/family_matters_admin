
export const allParents = [
  {
    id: 'PAR-001',
    names: 'Michael & Emma Davis',
    email: 'davis.family@email.com',
    phone: '+1 (555) 234-5678',
    ages: '32 & 29',
    location: 'Austin, Texas',
    status: 'matched',
    joinedDate: '2024-01-14',
    matchedSurrogate: 'Lisa Rodriguez',
    budget: '$80,000 - $100,000',
    experience: 'Second attempt',
    medicalReason: 'Uterine complications',
    preferences: {
      surrogateExperience: 'Experienced preferred',
      communicationLevel: 'Weekly updates',
      location: 'Texas or nearby states'
    },
    timeline: {
      applicationDate: '2024-01-14',
      approvalDate: '2024-01-20',
      matchDate: '2024-01-25',
      expectedDueDate: '2024-10-15'
    }
  },
  {
    id: 'PAR-002',
    names: 'James & Sophie Wilson',
    email: 'wilson.couple@email.com',
    phone: '+1 (555) 456-7890',
    ages: '35 & 33',
    location: 'New York, New York',
    status: 'searching',
    joinedDate: '2024-01-12',
    matchedSurrogate: null,
    budget: '$90,000 - $120,000',
    experience: 'First time',
    medicalReason: 'Multiple miscarriages',
    preferences: {
      surrogateExperience: 'Open to first-time',
      communicationLevel: 'Regular updates',
      location: 'East Coast preferred'
    },
    timeline: {
      applicationDate: '2024-01-12',
      approvalDate: null,
      matchDate: null,
      expectedDueDate: null
    }
  },
  {
    id: 'PAR-003',
    names: 'David & Rachel Chen',
    email: 'chen.family@email.com',
    phone: '+1 (555) 678-9012',
    ages: '38 & 36',
    location: 'San Francisco, California',
    status: 'approved',
    joinedDate: '2024-01-09',
    matchedSurrogate: null,
    budget: '$100,000 - $130,000',
    experience: 'First time',
    medicalReason: 'Age-related fertility issues',
    preferences: {
      surrogateExperience: 'Experienced preferred',
      communicationLevel: 'Monthly updates',
      location: 'California preferred'
    },
    timeline: {
      applicationDate: '2024-01-09',
      approvalDate: '2024-01-16',
      matchDate: null,
      expectedDueDate: null
    }
  },
  {
    id: 'PAR-004',
    names: 'Robert & Jennifer Martinez',
    email: 'martinez.family@email.com',
    phone: '+1 (555) 789-0123',
    ages: '34 & 31',
    location: 'Denver, Colorado',
    status: 'in-process',
    joinedDate: '2024-01-07',
    matchedSurrogate: 'Amanda Wilson',
    budget: '$75,000 - $95,000',
    experience: 'First time',
    medicalReason: 'Endometriosis',
    preferences: {
      surrogateExperience: 'Any',
      communicationLevel: 'Weekly updates',
      location: 'Mountain region preferred'
    },
    timeline: {
      applicationDate: '2024-01-07',
      approvalDate: '2024-01-14',
      matchDate: '2024-01-21',
      expectedDueDate: '2024-09-30'
    }
  },
  {
    id: 'PAR-005',
    names: 'Thomas & Lisa Anderson',
    email: 'anderson.family@email.com',
    phone: '+1 (555) 890-1234',
    ages: '40 & 37',
    location: 'Portland, Oregon',
    status: 'searching',
    joinedDate: '2024-01-05',
    matchedSurrogate: null,
    budget: '$85,000 - $110,000',
    experience: 'Second attempt',
    medicalReason: 'Previous surrogacy unsuccessful',
    preferences: {
      surrogateExperience: 'Experienced required',
      communicationLevel: 'Regular updates',
      location: 'West Coast only'
    },
    timeline: {
      applicationDate: '2024-01-05',
      approvalDate: '2024-01-12',
      matchDate: null,
      expectedDueDate: null
    }
  }
];

export const parentStatuses = [
  { value: 'all', label: 'All Parents', count: allParents.length },
  { value: 'searching', label: 'Searching', count: allParents.filter(p => p.status === 'searching').length },
  { value: 'matched', label: 'Matched', count: allParents.filter(p => p.status === 'matched').length },
  { value: 'in-process', label: 'In Process', count: allParents.filter(p => p.status === 'in-process').length },
  { value: 'approved', label: 'Approved', count: allParents.filter(p => p.status === 'approved').length }
];
