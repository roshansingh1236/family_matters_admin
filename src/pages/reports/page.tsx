import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/feature/Sidebar';
import Header from '../../components/feature/Header';
import Card from '../../components/base/Card';
import Button from '../../components/base/Button';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const ReportsPage: React.FC = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('6months');
  const [selectedReport, setSelectedReport] = useState('overview');
  const [stats, setStats] = useState({
    totalMatches: 0,
    activeJourneys: 0,
    successfulBirths: 0,
    totalRevenue: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const reportTypes = [
    { id: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { id: 'financial', label: 'Financial', icon: 'ri-money-dollar-circle-line' },
    { id: 'medical', label: 'Medical', icon: 'ri-health-book-line' },
    { id: 'performance', label: 'Performance', icon: 'ri-bar-chart-line' }
  ];

  const periods = [
    { id: '1month', label: 'Last Month' },
    { id: '3months', label: 'Last 3 Months' },
    { id: '6months', label: 'Last 6 Months' },
    { id: '1year', label: 'Last Year' }
  ];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const [casesSnapshot, paymentsSnapshot] = await Promise.all([
        getDocs(collection(db, 'cases')),
        getDocs(collection(db, 'invoices'))
      ]);

      const totalMatches = casesSnapshot.size;
      const activeJourneys = casesSnapshot.docs.filter((doc: any) => 
        doc.data().currentStage !== 'Completed'
      ).length;
      const successfulBirths = casesSnapshot.docs.filter((doc: any) => 
        doc.data().currentStage === 'Completed'
      ).length;
      
      const totalRevenue = paymentsSnapshot.docs.reduce((sum: number, doc: any) => {
        return sum + (doc.data().amount || 0);
      }, 0);

      setStats({
        totalMatches,
        activeJourneys,
        successfulBirths,
        totalRevenue
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const reportStats = [
    {
      id: 'total-matches',
      title: 'Total Matches',
      value: stats.totalMatches.toString(),
      icon: 'ri-links-line',
      color: 'blue'
    },
    {
      id: 'active-journeys',
      title: 'Active Journeys',
      value: stats.activeJourneys.toString(),
      icon: 'ri-road-map-line',
      color: 'green'
    },
    {
      id: 'successful-births',
      title: 'Successful Births',
      value: stats.successfulBirths.toString(),
      icon: 'ri-heart-3-line',
      color: 'pink'
    },
    {
      id: 'total-revenue',
      title: 'Total Revenue',
      value: `$${(stats.totalRevenue / 1000).toFixed(1)}K`,
      icon: 'ri-money-dollar-circle-line',
      color: 'purple'
    }
  ];

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Reports & Analytics</h1>
                <p className="text-gray-600 dark:text-gray-400">Comprehensive insights into your surrogacy program performance.</p>
              </div>
              <div className="flex gap-3">
                <select 
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white pr-8"
                >
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>{period.label}</option>
                  ))}
                </select>
                <Button color="blue">
                  <i className="ri-download-line mr-2"></i>
                  Export Report
                </Button>
              </div>
            </div>
          </div>

          {/* Report Type Tabs */}
          <div className="mb-6">
            <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg w-fit">
              {reportTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedReport(type.id)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    selectedReport === type.id
                      ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <i className={type.icon}></i>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {selectedReport === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <i className="ri-loader-4-line text-4xl animate-spin text-blue-600"></i>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {reportStats.map((stat) => (
                    <Card key={stat.id} className="hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">{stat.title}</p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                        </div>
                        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                          stat.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900' :
                          stat.color === 'green' ? 'bg-green-100 dark:bg-green-900' :
                          stat.color === 'pink' ? 'bg-pink-100 dark:bg-pink-900' :
                          'bg-purple-100 dark:bg-purple-900'
                        }`}>
                          <i className={`${stat.icon} text-xl ${
                            stat.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                            stat.color === 'green' ? 'text-green-600 dark:text-green-400' :
                            stat.color === 'pink' ? 'text-pink-600 dark:text-pink-400' :
                            'text-purple-600 dark:text-purple-400'
                          }`}></i>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedReport === 'financial' && (
            <Card>
              <div className="p-6">
                <div className="text-center py-12">
                  <i className="ri-money-dollar-circle-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Financial Reports</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Detailed financial analytics including revenue, expenses, and profit margins.
                  </p>
                  <Button color="blue">
                    <i className="ri-file-chart-line mr-2"></i>
                    Generate Financial Report
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {selectedReport === 'medical' && (
            <Card>
              <div className="p-6">
                <div className="text-center py-12">
                  <i className="ri-health-book-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Medical Reports</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Medical outcomes, success rates, and health statistics.
                  </p>
                  <Button color="blue">
                    <i className="ri-file-chart-line mr-2"></i>
                    Generate Medical Report
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {selectedReport === 'performance' && (
            <Card>
              <div className="p-6">
                <div className="text-center py-12">
                  <i className="ri-bar-chart-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Performance Reports</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Team performance metrics, efficiency ratings, and productivity analysis.
                  </p>
                  <Button color="blue">
                    <i className="ri-file-chart-line mr-2"></i>
                    Generate Performance Report
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
};

export default ReportsPage;
