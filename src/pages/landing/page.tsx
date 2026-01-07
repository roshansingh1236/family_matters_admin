import React from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <i className="ri-heart-line text-white text-xl"></i>
              </div>
              <span className="text-xl font-bold text-gray-900 dark:text-white">Family Matters</span>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => navigate('/auth/login')} 
                className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Log In
              </button>
              <button 
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-lg shadow-blue-600/20"
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
           {/* Abstract Background Shapes */}
           <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-purple-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
           <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            Reimagining Surrogacy Management
          </span>
          <h1 className="text-5xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            Making Family<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Actually Matters</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-300 mb-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            A comprehensive, modern platform designed to streamline the journey for agencies, surrogates, and intended parents.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <button 
               onClick={() => navigate('/')}
               className="w-full sm:w-auto px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg transition-transform hover:scale-105 shadow-xl shadow-blue-600/20"
            >
              Enter Dashboard
            </button>
            <button className="w-full sm:w-auto px-8 py-4 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white font-semibold text-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {[
                    { label: 'Families Created', value: '500+' },
                    { label: 'Active Surrogates', value: '1,200+' },
                    { label: 'Success Rate', value: '98%' },
                    { label: 'Global Reach', value: '30+ Countries' }
                ].map((stat, i) => (
                    <div key={i} className="text-center">
                        <p className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{stat.value}</p>
                        <p className="text-gray-600 dark:text-gray-400">{stat.label}</p>
                    </div>
                ))}
            </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Everything you need</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Powerful tools built specifically for the nuances of surrogacy program management.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { 
                icon: 'ri-dashboard-3-line', 
                title: 'Centralized Dashboard',
                desc: 'Get a bird\'s eye view of all active cases, pending applications, and critical alerts in one place.'
              },
              { 
                icon: 'ri-user-heart-line', 
                title: 'Smart Matching',
                desc: 'AI-assisted matching tools to help find the perfect connection between surrogates and intended parents.'
              },
              { 
                icon: 'ri-secure-payment-line', 
                title: 'Secure & Compliant',
                desc: 'Enterprise-grade security ensuring all sensitive medical and personal data remains protected.'
              },
              { 
                icon: 'ri-chat-smile-3-line', 
                title: 'Real-time Communication',
                desc: 'Integrated messaging system keeping agencies, parents, and surrogates connected effortlessly.'
              },
              { 
                icon: 'ri-calendar-event-line', 
                title: 'Journey Tracking',
                desc: 'Detailed milestone tracking from initial application through to post-birth legalities.'
              },
              { 
                icon: 'ri-file-text-line', 
                title: 'Doc Management',
                desc: 'Streamlined document collection, verification, and storage workflows.'
              }
            ].map((feature, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 p-8 rounded-2xl border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow group">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <i className={`${feature.icon} text-2xl text-blue-600 dark:text-blue-400`}></i>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 bg-blue-600 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1549420042-2d109bb333e2?q=80&w=2670&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-8">Ready to modernize your agency?</h2>
          <button 
             onClick={() => navigate('/auth/register')}
             className="px-8 py-4 bg-white text-blue-600 rounded-full font-bold text-lg hover:bg-gray-100 transition-colors shadow-xl"
          >
            Get Started Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                <i className="ri-heart-line text-white text-xs"></i>
              </div>
              <span className="text-lg font-bold text-gray-900 dark:text-white">Family Matters</span>
           </div>
           <p className="text-gray-500 dark:text-gray-400 text-sm">
             © 2026 Family Matters. All rights reserved.
           </p>
           <div className="flex gap-6">
             <a href="#" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="ri-twitter-line text-xl"></i></a>
             <a href="#" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="ri-linkedin-fill text-xl"></i></a>
             <a href="#" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><i className="ri-instagram-line text-xl"></i></a>
           </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
