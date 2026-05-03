export const CORE_PROFILE_TEMPLATE = {
  firstName: '',
  lastName: '',
  role: '',
  profileCompleted: false,
  form2Completed: false,
  profileCompletedAt: '',
  form2CompletedAt: ''
};

export const FORM_CONTACT_TEMPLATE = {
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  phone: '',
  city: '',
  state: '',
  country: '',
  zip: '',
  address: '',
  whenToStart: '',
  preferredContactMethod: '',
  message: '',
  clinic: ''
};

export const INITIAL_APPLICATION_TEMPLATE = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  city: '',
  state: '',
  zip: '',
  address: '',
  gender: '',
  age: '',
  height: '',
  weight: '',
  medications: '',
  smokesVapes: '',
  onPublicAssistance: '',
  hasBirthedChildren: '',
  areYouMarried: '',
  partnerFirstName: '',
  partnerLastName: '',
  partnerGender: '',
  whenToStart: '',
  whySurrogate: '',
  hasReferral: '',
  referralName: '',
  bestTime: '',
  clinic: '',
  message: ''
};


export const SURROGATE_ABOUT_FORM1_TEMPLATE = {
  city: '',
  state: '',
  whenToStart: ''
};

export const SURROGATE_FORM2_TEMPLATE = {
  availability: '',
  pregnancyHistory: {
    total: '',
    vaginal: '',
    cSection: ''
  },
  surrogacyChildren: '',
  bmi: '',
  smoker: false,
  medications: '',
  supportSystem: ''
};

export const SURROGATE_ADDITIONAL_TEMPLATE = {
  // Education & Employment
  educationLevel: '', hasCollegeDegree: '', collegeDetails: '',
  isEmployed: '', occupation: '', workHours: '', jobDuties: '',
  partnerEmployed: '', partnerOccupation: '', partnerWorkHours: '', partnerJobDuties: '',
  // Reproductive
  regularCycles: '', cycleFlow: '', menstrualFlow: '', lastPapSmear: '', papSmearResults: '',
  onBirthControl: '', birthControlType: '', isBreastfeeding: '',
  mentalHealth: '', usedTHC: '', postpartumDepression: '', bedrest: '',
  hepatitisBVaccination: '', rhogamInjection: '', fertilityTreatments: '',
  hadMiscarriage: '', miscarriageDetails: '', childrenBirthed: '', surrogacyChildren: '',
  // OB History
  additionalPregnancyInfo: '',
  // About Me
  favoriteFood: '', favoriteColor: '', favoriteFlower: '', favoriteMovie: '',
  relaxation: '', relationshipDescription: '', childrenRelationship: '',
  hobbies: '', personality: '', childhoodMemory: '',
  surrogacyReasons: '', surrogacyExcitement: '',
  // Journey Preferences
  mainSupport: '', spouseSupport: '', childrenSupport: '',
  parentsSupport: '', friendsSupport: '', coworkersSupport: '',
  understandsAppointments: '', duringRelationship: '', afterRelationship: '',
  allowOBAppointments: '', allowDeliveryRoom: '', helpCoupleWithChildren: '',
  helpSameSexCouple: '', helpSingleParent: '', fetusesWilling: '',
  reduceTripletsToTwins: '', reduceTwinsToSingleton: '',
  terminateIfNecessary: '', terminateDownSyndrome: '', amniocentesis: '',
  agreeToFetalTesting: '', messageToParents: ''
};

export const ABOUT_SURROGATE_TEMPLATE = {
  bioMotherHeritage: '',
  bioFatherHeritage: '',
  education: '',
  occupation: '',
  age: '',
  height: '',
  relationshipPreference: '',
  amhStatus: '',
  opennessToSecondCycle: '',
  bio: '',
  caption: ''
};

export const ABOUT_PARENT_TEMPLATE = {
  bio: '',
  age: '',
  aboutUs: '',
  relationshipPreference: '',
  familyLifestyle: '',
  occupation: '',
  education: '',
  heritage: '',
  religion: '',
  hobbies: '',
  caption: ''
};

export const PARENT_FORM2_TEMPLATE = {
  fertilityClinic: '',
  embryosAvailable: '',
  embryoQuality: '',
  medicalHistory: '',
  timeline: '',
  surrogacyBudget: '',
  legalCounsel: ''
};

export const FERTILITY_TEMPLATE = {
  clinicName: '',
  physician: '',
  clinicContact: '',
  embryoReport: '',
  geneticTesting: ''
};

export const PARENT_PROFILE_TEMPLATE = {
  name: '',
  dateOfBirth: '',
  occupation: '',
  phoneNumber: '',
  email: '',
  preferredPronouns: '',
  notes: ''
};

export const SURROGATE_PREFERENCES_TEMPLATE = {
  location: '',
  experiencePreference: '',
  communicationStyle: '',
  budgetRange: '',
  lifestylePreferences: ''
};



export const IP_FERTILITY_REPORT_TEMPLATE = {
  ivfEvaluationSummary: '',
  ovarianReserveAMH: '',
  semenAnalysis: '',
  diagnosis: ''
};

export const IP_INFECTIOUS_DISEASE_TEMPLATE = {
  hiv: '',
  hbsag: '',
  hcv: '',
  vdrl: '',
  cmv: ''
};

export const IP_EMBRYO_RECORDS_TEMPLATE = {
  embryoFreezingReport: '',
  donorScreeningReport: ''
};

export const SURROGATE_MEDICAL_FITNESS_TEMPLATE = {
  gynecologicalExam: '',
  obstetricHistory: '',
  bmi: '',
  bp: '',
  generalHealthClearance: ''
};

export const SURROGATE_INFECTIOUS_DISEASE_TEMPLATE = {
  hiv: '',
  hbsag: '',
  hcv: '',
  vdrl: '',
  torch: ''
};

export const SURROGATE_PSYCH_CLEARANCE_TEMPLATE = {
  mentalHealthClearanceDoc: ''
};

// Matches Flutter form_data.surrogate_profile (SurrogacyForm / form1.dart)
export const SURROGATE_INTAKE_TEMPLATE = {
  // Basic Info
  name: '', email: '', address: '', phone: '', height: '', weight: '', age: '', dob: '', bloodType: '',
  // COVID-19
  receivedVaccination: '', openToVaccination: '',
  // Background
  ethnicity: '', religion: '', languages: '', relationshipStatus: '', yearsTogether: '',
  // Transportation
  hasTransportation: '', canTravelForIVF: '', hasFlexibleSchedule: '',
  // Family
  hasCustody: '', householdMembers: '',
  // Education & Employment
  educationLevel: '', hasCollegeDegree: '', collegeDetails: '',
  isEmployed: '', occupation: '', workHours: '', jobDuties: '',
  partnerEmployed: '', partnerOccupation: '', partnerWorkHours: '', partnerJobDuties: '',
  // Reproductive (Flutter form2.dart uses menstrualFlow; form1 uses cycleFlow)
  regularCycles: '', cycleFlow: '', menstrualFlow: '', lastPapSmear: '', papSmearResults: '',
  onBirthControl: '', birthControlType: '', isBreastfeeding: '',
  mentalHealth: '', usedTHC: '', postpartumDepression: '', bedrest: '',
  hepatitisBVaccination: '', rhogamInjection: '', fertilityTreatments: '',
  hadMiscarriage: '', miscarriageDetails: '', childrenBirthed: '', surrogacyChildren: '',
  // OB History
  numberOfPregnancies: 0,
  pregnancy1Name: '', pregnancy1Gender: '', pregnancy1DOB: '', pregnancy1Weight: '',
  pregnancy1Delivery: '', pregnancy1GestationalAge: '', pregnancy1Complications: '',
  pregnancy1OBGYN: '', pregnancy1Hospital: '',
  pregnancy2Name: '', pregnancy2Gender: '', pregnancy2DOB: '', pregnancy2Weight: '',
  pregnancy2Delivery: '', pregnancy2GestationalAge: '', pregnancy2Complications: '',
  pregnancy2OBGYN: '', pregnancy2Hospital: '', pregnancy2Surrogacy: '',
  pregnancy3Name: '', pregnancy3Gender: '', pregnancy3DOB: '', pregnancy3Weight: '',
  pregnancy3Delivery: '', pregnancy3GestationalAge: '', pregnancy3Complications: '',
  pregnancy3OBGYN: '', pregnancy3Hospital: '', pregnancy3Surrogacy: '',
  additionalPregnancyInfo: '',
  // About Me
  favoriteFood: '', favoriteColor: '', favoriteFlower: '', favoriteMovie: '',
  relaxation: '', relationshipDescription: '', childrenRelationship: '',
  hobbies: '', personality: '', childhoodMemory: '',
  surrogacyReasons: '', surrogacyExcitement: '',
  // Journey Preferences
  mainSupport: '', spouseSupport: '', childrenSupport: '',
  parentsSupport: '', friendsSupport: '', coworkersSupport: '',
  understandsAppointments: '', duringRelationship: '', afterRelationship: '',
  allowOBAppointments: '', allowDeliveryRoom: '', helpCoupleWithChildren: '',
  helpSameSexCouple: '', helpSingleParent: '', fetusesWilling: '',
  reduceTripletsToTwins: '', reduceTwinsToSingleton: '',
  terminateIfNecessary: '', terminateDownSyndrome: '', amniocentesis: '',
  agreeToFetalTesting: '', willingForSplitTwins: false, messageToParents: ''
};

// Matches Flutter form_data.parent1 and form_data.parent2 (IntendedParentsSignUpForm / form1.dart + form2.dart)
export const IP_PARENT_FORM_TEMPLATE = {
  name: '', gender: '', age: '', address: '', dob: '', occupation: '', language: '', religion: '',
  communication_preference: '', relationship_status: '', number_of_children: 0,
  relationship_duration: '', relationship_description: '', children_feelings: '',
  relationship_with_children: '', family_friends_opinion: '',
  favorite_food: '', favorite_color: '', favorite_movie_show: '',
  relaxation_method: '', hobbies_interests: '', personality_description: '',
  about_yourself: '', difficult_decision_reason: '',
  attend_ob_appointments: false, attend_delivery_room: false
};

// Matches Flutter form_data.medical_reports (medical_reports_form.dart)
export const IP_MEDICAL_REPORTS_TEMPLATE = {
  ivf_evaluation_summary: '', ovarian_reserve_amh: '', semen_analysis: '', diagnosis: '',
  hiv_result: '', hbs_ag_result: '', hcv_result: '', vdrl_result: '', cmv_result: '',
  fertility_report_files_count: 0, disease_screening_files_count: 0, embryo_records_files_count: 0
};

// Matches Flutter form_data.surrogate_related (surrogate_related_question.dart)
export const IP_SURROGATE_RELATED_TEMPLATE = {
  past_surrogate_experience: '',
  need_for_surrogate_assistance: '',
  surrogate_selection_criteria: '',
  pregnancy_relationship: '',
  additional_info_for_surrogate: '',
  worked_with_surrogate_before: false,
  contact_after_birth: 5,
  contact_after_birth_explanation: '',
  tell_child_about_surrogate: false,
  introduce_surrogate_to_children: false
};

// Matches Flutter form_data.fertility (frequent_question.dart)
export const IP_FERTILITY_QUESTIONS_TEMPLATE = {
  working_with_fertility_doctor: false,
  fertility_doctor: '',
  egg_provider: '',
  willing_to_consider_egg_donor: false,
  selected_egg_donor: false,
  egg_donor_age: '',
  egg_donor_proven_doctor: false,
  egg_donor_is_known: false,
  intended_father_providing_sperm: false,
  using_frozen_embryos: false,
  embryos_frozen_date: '',
  number_of_embryos: '',
  pgd_pgs_tested: false,
  pgd_pgs_testing_info: '',
  embryos_to_transfer: '',
  abort_or_reduce_pregnancy: false,
  abnormality_definition: '',
  fertility_history_info: ''
};
