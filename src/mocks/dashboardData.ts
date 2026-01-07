
export const dashboardStats = [
  {
    id: 'total-requests',
    title: 'Total Requests',
    value: '247',
    change: '+12%',
    changeType: 'increase',
    icon: 'ri-file-list-3-line',
    color: 'blue'
  },
  {
    id: 'active-surrogates',
    title: 'Active Surrogates',
    value: '89',
    change: '+5%',
    changeType: 'increase',
    icon: 'ri-user-heart-line',
    color: 'green'
  },
  {
    id: 'intended-parents',
    title: 'Intended Parents',
    value: '156',
    change: '+8%',
    changeType: 'increase',
    icon: 'ri-parent-line',
    color: 'purple'
  },
  {
    id: 'successful-matches',
    title: 'Successful Matches',
    value: '73',
    change: '+15%',
    changeType: 'increase',
    icon: 'ri-links-line',
    color: 'orange'
  }
];

export const recentRequests = [
  {
    id: 'REQ-001',
    applicantName: 'Sarah Johnson',
    type: 'Surrogate Application',
    status: 'pending',
    submittedDate: '2024-01-15',
    location: 'California, USA',
    age: 28,
    experience: 'First time'
  },
  {
    id: 'REQ-002',
    applicantName: 'Michael & Emma Davis',
    type: 'Intended Parents',
    status: 'under-review',
    submittedDate: '2024-01-14',
    location: 'Texas, USA',
    age: '32 & 29',
    experience: 'Second attempt'
  },
  {
    id: 'REQ-003',
    applicantName: 'Lisa Rodriguez',
    type: 'Surrogate Application',
    status: 'approved',
    submittedDate: '2024-01-13',
    location: 'Florida, USA',
    age: 31,
    experience: 'Experienced (2 previous)'
  },
  {
    id: 'REQ-004',
    applicantName: 'James & Sophie Wilson',
    type: 'Intended Parents',
    status: 'pending',
    submittedDate: '2024-01-12',
    location: 'New York, USA',
    age: '35 & 33',
    experience: 'First time'
  },
  {
    id: 'REQ-005',
    applicantName: 'Maria Garcia',
    type: 'Surrogate Application',
    status: 'under-review',
    submittedDate: '2024-01-11',
    location: 'Arizona, USA',
    age: 26,
    experience: 'First time'
  }
];

export const upcomingAppointments = [
  {
    id: 'APP-001',
    title: 'Medical Screening - Sarah Johnson',
    time: '10:00 AM',
    date: '2024-01-16',
    type: 'medical',
    location: 'Fertility Clinic A'
  },
  {
    id: 'APP-002',
    title: 'Consultation - Davis Family',
    time: '2:30 PM',
    date: '2024-01-16',
    type: 'consultation',
    location: 'Office Conference Room'
  },
  {
    id: 'APP-003',
    title: 'Legal Review - Contract Signing',
    time: '11:00 AM',
    date: '2024-01-17',
    type: 'legal',
    location: 'Legal Office'
  },
  {
    id: 'APP-004',
    title: 'Psychological Evaluation - Lisa Rodriguez',
    time: '3:00 PM',
    date: '2024-01-17',
    type: 'psychological',
    location: 'Psychology Center'
  }
];

export const recentActivity = [
  {
    id: 'ACT-001',
    action: 'New surrogate application submitted',
    user: 'Sarah Johnson',
    timestamp: '2 hours ago',
    type: 'application'
  },
  {
    id: 'ACT-002',
    action: 'Medical clearance approved',
    user: 'Dr. Smith',
    timestamp: '4 hours ago',
    type: 'medical'
  },
  {
    id: 'ACT-003',
    action: 'Contract signed by intended parents',
    user: 'Davis Family',
    timestamp: '6 hours ago',
    type: 'contract'
  },
  {
    id: 'ACT-004',
    action: 'Match proposal sent',
    user: 'Admin Team',
    timestamp: '8 hours ago',
    type: 'match'
  },
  {
    id: 'ACT-005',
    action: 'Payment processed',
    user: 'Finance Team',
    timestamp: '1 day ago',
    type: 'payment'
  }
];

export const recentMedicalRecords = [
  {
    id: 'MED-001',
    title: 'Initial Medical Screening',
    patient: 'Emma Thompson',
    date: '2024-01-10',
    doctor: 'Dr. Michael Chen',
    facility: 'Reproductive Health Center',
    status: 'completed',
    attachments: 2
  },
  {
    id: 'MED-002',
    title: 'Psychological Evaluation',
    patient: 'Sarah Johnson',
    date: '2024-01-08',
    doctor: 'Dr. Lisa Park',
    facility: 'Mental Health Associates',
    status: 'pending',
    attachments: 1
  },
  {
    id: 'MED-003',
    title: 'Fertility Assessment',
    patient: 'Maria Garcia',
    date: '2024-01-05',
    doctor: 'Dr. Robert Kim',
    facility: 'Advanced Fertility Clinic',
    status: 'in-progress',
    attachments: 3
  }
];

// Combined dashboard data export
export const dashboardData = {
  stats: [
    {
      id: 'online-inquiries',
      label: 'Online Inquiries',
      value: '12',
      change: '+3%',
      trend: 'up',
      icon: 'ri-global-line',
      color: 'bg-indigo-100 text-indigo-600'
    },
    {
      id: 'phone-inquiries',
      label: 'Phone Inquiries',
      value: '5',
      change: '+1%',
      trend: 'up',
      icon: 'ri-phone-line',
      color: 'bg-pink-100 text-pink-600'
    },
    {
      id: 'total-requests',
      label: 'Total Requests',
      value: '247',
      change: '+12%',
      trend: 'up',
      icon: 'ri-file-list-3-line',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      id: 'active-surrogates',
      label: 'Active Surrogates',
      value: '89',
      change: '+5%',
      trend: 'up',
      icon: 'ri-user-heart-line',
      color: 'bg-green-100 text-green-600'
    },
    {
      id: 'intended-parents',
      label: 'Intended Parents',
      value: '156',
      change: '+8%',
      trend: 'up',
      icon: 'ri-parent-line',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      id: 'successful-matches',
      label: 'Successful Matches',
      value: '73',
      change: '+15%',
      trend: 'up',
      icon: 'ri-links-line',
      color: 'bg-orange-100 text-orange-600'
    }
  ],
  recentRequests: [
    {
      id: 'REQ-001',
      name: 'Sarah Johnson',
      type: 'Surrogate Application',
      status: 'pending',
      date: '2024-01-15'
    },
    {
      id: 'REQ-002',
      name: 'Michael & Emma Davis',
      type: 'Intended Parents',
      status: 'approved',
      date: '2024-01-14'
    },
    {
      id: 'REQ-003',
      name: 'Lisa Rodriguez',
      type: 'Surrogate Application',
      status: 'approved',
      date: '2024-01-13'
    },
    {
      id: 'REQ-004',
      name: 'James & Sophie Wilson',
      type: 'Intended Parents',
      status: 'pending',
      date: '2024-01-12'
    }
  ],
  upcomingAppointments: [
    {
      id: 'APP-001',
      title: 'Medical Screening - Sarah Johnson',
      time: '10:00 AM Today'
    },
    {
      id: 'APP-002',
      title: 'Consultation - Davis Family',
      time: '2:30 PM Today'
    },
    {
      id: 'APP-003',
      title: 'Legal Review - Contract Signing',
      time: '11:00 AM Tomorrow'
    },
    {
      id: 'APP-004',
      title: 'Psychological Evaluation',
      time: '3:00 PM Tomorrow'
    }
  ],
  recentMedicalRecords: [
    {
      id: 'MED-001',
      title: 'Initial Medical Screening',
      patient: 'Emma Thompson',
      date: '2024-01-10',
      doctor: 'Dr. Michael Chen',
      facility: 'Reproductive Health Center',
      status: 'completed',
      attachments: 2
    },
    {
      id: 'MED-002',
      title: 'Psychological Evaluation',
      patient: 'Sarah Johnson',
      date: '2024-01-08',
      doctor: 'Dr. Lisa Park',
      facility: 'Mental Health Associates',
      status: 'pending',
      attachments: 1
    },
    {
      id: 'MED-003',
      title: 'Fertility Assessment',
      patient: 'Maria Garcia',
      date: '2024-01-05',
      doctor: 'Dr. Robert Kim',
      facility: 'Advanced Fertility Clinic',
      status: 'in-progress',
      attachments: 3
    }
  ]
};
