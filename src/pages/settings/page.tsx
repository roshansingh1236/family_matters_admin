import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { useAuth } from '../../contexts/AuthContext';
import DataSection from '../../components/data/DataSection';

const SettingsPage: React.FC = () => {
  const { user, profile, profileLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    siteName: 'Family Matters',
    adminEmail: 'admin@familymatters.com',
    timezone: 'UTC-5',
    language: 'English',
    notifications: {
      email: true,
      sms: true,
      push: true,
      newRequests: true,
      appointments: true,
      payments: false
    },
    security: {
      twoFactor: false,
      sessionTimeout: '30',
      passwordExpiry: '90'
    },
    matching: {
      autoMatch: false,
      requireApproval: true,
      maxMatches: '3'
    }
  });

  useEffect(() => {
    if (profile && typeof profile === 'object' && profile.email) {
      setSettings((prev) => {
        if (prev.adminEmail === profile.email) {
          return prev;
        }
        return {
          ...prev,
          adminEmail: profile.email as string
        };
      });
    }
  }, [profile]);

  const accountDisplayName = useMemo(() => {
    if (user?.displayName && user.displayName.trim().length > 0) {
      return user.displayName;
    }

    if (user?.email) {
      const [localPart] = user.email.split('@');
      return localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }

    return 'Administrator';
  }, [user]);

  const accountEmail =
    (profile && typeof profile === 'object' && (profile.email as string | undefined)) ?? user?.email ?? settings.adminEmail;

  const accountInitials = useMemo(() => {
    const source = accountDisplayName || accountEmail || 'FM';
    const initials = source
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')
      .slice(0, 2);

    return initials.length > 0 ? initials : 'FM';
  }, [accountDisplayName, accountEmail]);

  const memberSince = useMemo(() => {
    if (user?.metadata?.creationTime) {
      return new Date(user.metadata.creationTime).toLocaleDateString();
    }
    return null;
  }, [user]);

  const lastSignIn = useMemo(() => {
    if (user?.metadata?.lastSignInTime) {
      return new Date(user.metadata.lastSignInTime).toLocaleString();
    }
    return null;
  }, [user]);

  const providers = useMemo(() => {
    if (!user?.providerData?.length) {
      return 'Email & Password';
    }

    return user.providerData
      .map((provider) => {
        switch (provider.providerId) {
          case 'password':
            return 'Email & Password';
          case 'google.com':
            return 'Google';
          case 'facebook.com':
            return 'Facebook';
          case 'apple.com':
            return 'Apple';
          default:
            return provider.providerId;
        }
      })
      .join(', ');
  }, [user]);

  const settingsTabs = [
    { id: 'general', label: 'General', icon: 'ri-settings-3-line' },
    { id: 'notifications', label: 'Notifications', icon: 'ri-notification-3-line' },
    { id: 'security', label: 'Security', icon: 'ri-shield-check-line' },
    { id: 'matching', label: 'Matching Rules', icon: 'ri-links-line' },
    { id: 'billing', label: 'Billing', icon: 'ri-money-dollar-circle-line' },
    { id: 'integrations', label: 'Integrations', icon: 'ri-plug-line' }
  ];

  const handleSettingChange = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
  };

  const renderGeneralSettings = () => (
    <div className="space-y-8">
      {profileLoading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-48 bg-gray-100 dark:bg-gray-800 rounded"></div>
        </div>
      ) : (
        <div className="space-y-6">
          <DataSection
            title="Profile Overview"
            data={{
              Name: accountDisplayName,
              Email: accountEmail,
              Role: profile?.role ?? '—',
              'Profile Completed': profile?.profileCompleted,
              'Form 2 Completed': profile?.form2Completed,
              'Created At': profile?.createdAt,
              'Updated At': profile?.updatedAt
            }}
          />
          <DataSection
            title="Form 1 Responses"
            data={(profile?.formData as Record<string, unknown>) ?? null}
            emptyMessage="No form data available."
          />
          <DataSection
            title="Form 2 Responses"
            data={(profile?.form2Data as Record<string, unknown>) ?? null}
            emptyMessage="Form 2 has not been completed yet."
          />
          <DataSection
            title="Fertility Information"
            data={((profile?.form2Data as Record<string, unknown>)?.fertility as Record<string, unknown>) ?? null}
            emptyMessage="No fertility information provided."
          />
          <DataSection
            title="Parent 1"
            data={(profile?.parent1 as Record<string, unknown>) ?? null}
            emptyMessage="Parent 1 details not provided."
          />
          <DataSection
            title="Parent 2"
            data={(profile?.parent2 as Record<string, unknown>) ?? null}
            emptyMessage="Parent 2 details not provided."
          />
          <DataSection
            title="Surrogate Related Preferences"
            data={(profile?.surrogateRelated as Record<string, unknown>) ?? null}
            emptyMessage="No surrogate preferences provided."
          />
        </div>
      )}

      <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Site Name
          </label>
          <input
            type="text"
            value={settings.siteName}
            onChange={(e) => setSettings(prev => ({ ...prev, siteName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Admin Email
          </label>
          <input
            type="email"
            value={settings.adminEmail}
            onChange={(e) => setSettings(prev => ({ ...prev, adminEmail: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Timezone
          </label>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
            className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          >
            <option value="UTC-5">Eastern Time (UTC-5)</option>
            <option value="UTC-6">Central Time (UTC-6)</option>
            <option value="UTC-7">Mountain Time (UTC-7)</option>
            <option value="UTC-8">Pacific Time (UTC-8)</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Channels</h3>
        <div className="space-y-4">
          {Object.entries(settings.notifications).slice(0, 3).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300 capitalize">{key} Notifications</span>
              <button
                onClick={() => handleSettingChange('notifications', key, !value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Event Notifications</h3>
        <div className="space-y-4">
          {Object.entries(settings.notifications).slice(3).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
              <button
                onClick={() => handleSettingChange('notifications', key, !value)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  value ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Two-Factor Authentication</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">Add an extra layer of security to your account</p>
        </div>
        <button
          onClick={() => handleSettingChange('security', 'twoFactor', !settings.security.twoFactor)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
            settings.security.twoFactor ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.security.twoFactor ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Session Timeout (minutes)
        </label>
        <select
          value={settings.security.sessionTimeout}
          onChange={(e) => handleSettingChange('security', 'sessionTimeout', e.target.value)}
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="15">15 minutes</option>
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="120">2 hours</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Password Expiry (days)
        </label>
        <select
          value={settings.security.passwordExpiry}
          onChange={(e) => handleSettingChange('security', 'passwordExpiry', e.target.value)}
          className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        >
          <option value="30">30 days</option>
          <option value="60">60 days</option>
          <option value="90">90 days</option>
          <option value="never">Never</option>
        </select>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralSettings();
      case 'notifications':
        return renderNotificationSettings();
      case 'security':
        return renderSecuritySettings();
      case 'matching':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Auto-Matching</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Automatically suggest matches based on criteria</p>
              </div>
              <button
                onClick={() => handleSettingChange('matching', 'autoMatch', !settings.matching.autoMatch)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  settings.matching.autoMatch ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.matching.autoMatch ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Maximum Active Matches per Surrogate
              </label>
              <select
                value={settings.matching.maxMatches}
                onChange={(e) => handleSettingChange('matching', 'maxMatches', e.target.value)}
                className="w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="1">1 Match</option>
                <option value="2">2 Matches</option>
                <option value="3">3 Matches</option>
                <option value="5">5 Matches</option>
              </select>
            </div>
          </div>
        );
      case 'billing':
        return (
          <div className="space-y-6">
            <div className="text-center py-12">
              <i className="ri-money-dollar-circle-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Billing Settings</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Configure payment methods and billing preferences
              </p>
              <Button color="blue">
                <i className="ri-add-line mr-2"></i>
                Add Payment Method
              </Button>
            </div>
          </div>
        );
      case 'integrations':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                      <i className="ri-mail-line text-blue-600 dark:text-blue-400"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Email Service</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">SMTP configuration</p>
                    </div>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>
              </Card>
              <Card>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                      <i className="ri-phone-line text-green-600 dark:text-green-400"></i>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">SMS Service</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Twilio integration</p>
                    </div>
                  </div>
                  <Button variant="outline">Configure</Button>
                </div>
              </Card>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400">Manage your application preferences and configurations.</p>
          </div>

          <Card className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-semibold">
                  {accountInitials}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {profileLoading ? 'Loading...' : accountDisplayName}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {profileLoading ? 'Loading account...' : accountEmail}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto">
                {memberSince && (
                  <div>
                    <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide">Member Since</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{memberSince}</p>
                  </div>
                )}
                {lastSignIn && (
                  <div>
                    <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide">Last Sign-in</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{lastSignIn}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase text-gray-500 dark:text-gray-400 tracking-wide">Auth Provider</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{providers}</p>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex gap-6">
            {/* Settings Navigation */}
            <div className="w-64 flex-shrink-0">
              <Card>
                <nav className="space-y-1">
                  {settingsTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                        activeTab === tab.id
                          ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <i className={`${tab.icon} text-lg`}></i>
                      <span className="font-medium">{tab.label}</span>
                    </button>
                  ))}
                </nav>
              </Card>
            </div>

            {/* Settings Content */}
            <div className="flex-1">
              <Card>
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {settingsTabs.find(tab => tab.id === activeTab)?.label}
                  </h2>
                </div>
                {renderContent()}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex gap-3">
                    <Button color="blue">
                      <i className="ri-save-line mr-2"></i>
                      Save Changes
                    </Button>
                    <Button variant="outline">
                      <i className="ri-refresh-line mr-2"></i>
                      Reset to Default
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
