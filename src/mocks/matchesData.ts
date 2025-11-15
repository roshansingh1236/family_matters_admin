
export const allMatches = [
  {
    id: 'MATCH-001',
    surrogate: {
      id: 'SUR-002',
      name: 'Lisa Rodriguez',
      age: 31,
      location: 'Miami, Florida',
      experience: 'Experienced (2 previous)'
    },
    intendedParents: {
      id: 'PAR-001',
      names: 'Michael & Emma Davis',
      ages: '32 & 29',
      location: 'Austin, Texas'
    },
    matchDate: '2024-01-25',
    status: 'active',
    stage: 'medical-screening',
    contractSigned: true,
    expectedDueDate: '2024-10-15',
    compensation: '$55,000',
    milestones: [
      { name: 'Initial Match', date: '2024-01-25', completed: true },
      { name: 'Meet & Greet', date: '2024-01-28', completed: true },
      { name: 'Legal Consultation', date: '2024-02-01', completed: true },
      { name: 'Contract Signing', date: '2024-02-05', completed: true },
      { name: 'Medical Screening', date: '2024-02-10', completed: false },
      { name: 'Embryo Transfer', date: '2024-02-20', completed: false }
    ]
  },
  {
    id: 'MATCH-002',
    surrogate: {
      id: 'SUR-004',
      name: 'Amanda Wilson',
      age: 33,
      location: 'Chicago, Illinois',
      experience: 'Experienced (1 previous)'
    },
    intendedParents: {
      id: 'PAR-004',
      names: 'Robert & Jennifer Martinez',
      ages: '34 & 31',
      location: 'Denver, Colorado'
    },
    matchDate: '2024-01-21',
    status: 'active',
    stage: 'pregnancy',
    contractSigned: true,
    expectedDueDate: '2024-09-30',
    compensation: '$52,000',
    milestones: [
      { name: 'Initial Match', date: '2024-01-21', completed: true },
      { name: 'Meet & Greet', date: '2024-01-24', completed: true },
      { name: 'Legal Consultation', date: '2024-01-28', completed: true },
      { name: 'Contract Signing', date: '2024-02-01', completed: true },
      { name: 'Medical Screening', date: '2024-02-05', completed: true },
      { name: 'Embryo Transfer', date: '2024-02-15', completed: true }
    ]
  },
  {
    id: 'MATCH-003',
    surrogate: {
      id: 'SUR-006',
      name: 'Jennifer Thompson',
      age: 29,
      location: 'Seattle, Washington',
      experience: 'First time'
    },
    intendedParents: {
      id: 'PAR-006',
      names: 'David & Sarah Kim',
      ages: '36 & 34',
      location: 'Portland, Oregon'
    },
    matchDate: '2024-01-18',
    status: 'completed',
    stage: 'delivery',
    contractSigned: true,
    expectedDueDate: '2024-01-20',
    compensation: '$48,000',
    milestones: [
      { name: 'Initial Match', date: '2023-05-15', completed: true },
      { name: 'Meet & Greet', date: '2023-05-18', completed: true },
      { name: 'Legal Consultation', date: '2023-05-22', completed: true },
      { name: 'Contract Signing', date: '2023-05-25', completed: true },
      { name: 'Medical Screening', date: '2023-06-01', completed: true },
      { name: 'Embryo Transfer', date: '2023-06-10', completed: true },
      { name: 'Successful Delivery', date: '2024-01-20', completed: true }
    ]
  }
];

export const matchStatuses = [
  { value: 'all', label: 'All Matches', count: allMatches.length },
  { value: 'active', label: 'Active', count: allMatches.filter(m => m.status === 'active').length },
  { value: 'completed', label: 'Completed', count: allMatches.filter(m => m.status === 'completed').length },
  { value: 'pending', label: 'Pending', count: allMatches.filter(m => m.status === 'pending').length },
  { value: 'cancelled', label: 'Cancelled', count: allMatches.filter(m => m.status === 'cancelled').length }
];
