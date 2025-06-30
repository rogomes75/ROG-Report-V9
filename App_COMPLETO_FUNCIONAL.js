import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';
import axios from 'axios';
import moment from 'moment-timezone';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Debug logging
console.log('BACKEND_URL:', BACKEND_URL);
console.log('API URL:', API);
console.log('Using full backend URL for API calls');

// Utility function to format LA time - Fixed timezone issue
const formatLATime = (date) => {
  return moment.utc(date).tz('America/Los_Angeles').format('MM/DD/YYYY');
};

const formatLADateTime = (date) => {
  return moment.utc(date).tz('America/Los_Angeles').format('MM/DD/YYYY hh:mm A');
};

const formatLATimeOnly = (date) => {
  return moment.utc(date).tz('America/Los_Angeles').format('hh:mm A');
};

// Format number with commas
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

// Auth Context
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    }
  }, [token]);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Login Component
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const success = await login(username, password);
    if (!success) {
      setError('Invalid username or password');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600 mb-4">ROG Pool Service</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Please contact your administrator for login credentials</p>
        </div>
      </div>
    </div>
  );
};

// Navigation Component
const Navigation = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <h1 className="text-lg sm:text-2xl font-bold text-blue-600">ROG Pool Service</h1>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full uppercase">
              {user?.role}
            </span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Services Reported
            </button>
            
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === 'completed'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Services Completed
            </button>
            
            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('clients')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === 'clients'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Clients Management
                </button>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === 'users'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === 'calendar'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Financial
                </button>
                <button
                  onClick={() => setActiveTab('reports-download')}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    activeTab === 'reports-download'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Reports
                </button>
              </>
            )}

            <div className="flex items-center space-x-2">
              <span className="text-gray-700 text-sm">{user?.username}</span>
              <button
                onClick={logout}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center space-x-2">
            <span className="text-gray-700 text-sm">{user?.username}</span>
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="text-gray-600 hover:text-blue-600 p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => {
                  setActiveTab('reports');
                  setShowMobileMenu(false);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition text-left ${
                  activeTab === 'reports'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                Services Reported
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('completed');
                  setShowMobileMenu(false);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition text-left ${
                  activeTab === 'completed'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-blue-600'
                }`}
              >
                Services Completed
              </button>
              
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={() => {
                      setActiveTab('clients');
                      setShowMobileMenu(false);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition text-left ${
                      activeTab === 'clients'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-blue-600'
                    }`}
                  >
                    Clients Management
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('users');
                      setShowMobileMenu(false);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition text-left ${
                      activeTab === 'users'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-blue-600'
                    }`}
                  >
                    Users
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('calendar');
                      setShowMobileMenu(false);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition text-left ${
                      activeTab === 'calendar'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-blue-600'
                    }`}
                  >
                    Financial
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('reports-download');
                      setShowMobileMenu(false);
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition text-left ${
                      activeTab === 'reports-download'
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:text-blue-600'
                    }`}
                  >
                    Reports
                  </button>
                </>
              )}
              
              <button
                onClick={logout}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition text-left mt-4"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

// Service Reports Component
const ServiceReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedUserFilter, setSelectedUserFilter] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [currentMedia, setCurrentMedia] = useState({ src: '', type: '' });

  // Form states
  const [selectedClient, setSelectedClient] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('SAME WEEK');
  const [photos, setPhotos] = useState([]);
  const [videos, setVideos] = useState([]);
  const [employeeNotes, setEmployeeNotes] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [partsCost, setPartsCost] = useState('');
  const [grossProfit, setGrossProfit] = useState('');

  useEffect(() => {
    fetchReports();
    fetchClients();
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, selectedUserFilter]);

  const filterReports = () => {
    let filtered = reports;
    
    if (selectedUserFilter) {
      filtered = filtered.filter(report => report.employee_id === selectedUserFilter);
    }
    
    setFilteredReports(filtered);
  };

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API}/reports`);
      // Filter out completed reports - they should only appear in Completed tab
      const activeReports = response.data.filter(report => report.status !== 'completed');
      setReports(activeReports);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.role === 'employee'));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (photos.length + files.length > 5) {
      alert('Maximum 5 photos allowed');
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setPhotos(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (videos.length + files.length > 2) {
      alert('Maximum 2 videos allowed');
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setVideos(prev => [...prev, event.target.result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeVideo = (index) => {
    setVideos(prev => prev.filter((_, i) => i !== index));
  };

  const openMediaViewer = (src, type) => {
    setCurrentMedia({ src, type });
    setShowMediaViewer(true);
  };

  const closeMediaViewer = () => {
    setShowMediaViewer(false);
    setCurrentMedia({ src: '', type: '' });
  };

  const resetForm = () => {
    setSelectedClient('');
    setDescription('');
    setPriority('SAME WEEK');
    setPhotos([]);
    setVideos([]);
    setEmployeeNotes('');
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post(`${API}/reports`, {
        client_id: selectedClient,
        description,
        priority,
        photos,
        videos
      });

      setShowCreateForm(false);
      resetForm();
      fetchReports();
    } catch (error) {
      console.error('Failed to create report:', error);
      alert('Failed to create report');
    }
    setIsLoading(false);
  };

  const handleEditReport = (report) => {
    setEditingReport(report);
    setSelectedClient(report.client_id);
    setDescription(report.description);
    setPriority(report.priority);
    setPhotos(report.photos || []);
    setEmployeeNotes(report.employee_notes || '');
    setAdminNotes(report.admin_notes || '');
    setTotalCost(report.total_cost?.toString() || '');
    setPartsCost(report.parts_cost?.toString() || '');
    setGrossProfit(report.gross_profit?.toString() || '');
    setShowEditForm(true);
  };

  const handleUpdateReport = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updateData = {
        description,
        priority,
        photos,
        employee_notes: employeeNotes
      };

      if (user?.role === 'admin') {
        updateData.admin_notes = adminNotes;
        if (totalCost) updateData.total_cost = parseFloat(totalCost);
        if (partsCost) updateData.parts_cost = parseFloat(partsCost);
        if (totalCost && partsCost) {
          updateData.gross_profit = parseFloat(totalCost) - parseFloat(partsCost);
        }
      }

      await axios.put(`${API}/reports/${editingReport.id}`, updateData);

      setShowEditForm(false);
      resetForm();
      fetchReports();
    } catch (error) {
      console.error('Failed to update report:', error);
      alert('Failed to update report');
    }
    setIsLoading(false);
  };

  const updateReportStatus = async (reportId, status, notes = '', completionDate = null) => {
    try {
      await axios.put(`${API}/reports/${reportId}`, {
        status,
        admin_notes: notes,
        completion_date: completionDate
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to update report:', error);
    }
  };
  const updateFinancialField = async (reportId, field, value) => {
    try {
      await axios.put(`${API}/reports/${reportId}`, {
        [field]: value
      });
      fetchReports();
    } catch (error) {
      console.error(`Failed to update ${field}:`, error);
    }
  };


  const updateAdminNotes = async (reportId, notes) => {
    try {
      await axios.put(`${API}/reports/${reportId}`, {
        admin_notes: notes
      });
      fetchReports();
    } catch (error) {
      console.error('Failed to update admin notes:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'reported': 'bg-yellow-100 text-yellow-800',
      'scheduled': 'bg-blue-100 text-blue-800',
      'in_progress': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getReportPeriod = () => {
    if (filteredReports.length === 0) return 'No reports';
    
    const dates = filteredReports.map(r => new Date(r.request_date));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    if (minDate.toDateString() === maxDate.toDateString()) {
      return formatLATime(minDate);
    }
    
    return `${formatLATime(minDate)} - ${formatLATime(maxDate)}`;
  };

  const isReportOverdue = (report) => {
    const today = new Date();
    const reportDate = new Date(report.request_date);
    const diffTime = today - reportDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 2;
  };

  const getReportFlag = (report) => {
    const today = new Date();
    const reportDate = new Date(report.request_date);
    const diffTime = today - reportDate;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) { // Today or 1 day before
      return '🟢'; // Green flag 
    } else if (diffDays >= 2) { // 2 or more days before
      return '🔴'; // Red flag
    }
    return null;
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'URGENT': 'bg-red-100 text-red-800',
      'SAME WEEK': 'bg-orange-100 text-orange-800',
      'NEXT WEEK': 'bg-blue-100 text-blue-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Service Reports</h2>
            <div className="flex items-center gap-2">
              {user?.role === 'employee' && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Add Report
                </button>
              )}
              {user?.role === 'admin' && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Add Report
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-1">Period: {getReportPeriod()}</p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              Scheduled: {filteredReports.filter(r => r.status === 'scheduled').length}
            </span>
            <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full">
              In Progress: {filteredReports.filter(r => r.status === 'in_progress').length}
            </span>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full">
              Reported: {filteredReports.filter(r => r.status === 'reported').length}
            </span>
            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full">
              Late: {filteredReports.filter(r => getReportFlag(r) === '🔴').length}
            </span>
          </div>
          
          {/* User Filter for Admin */}
          {user?.role === 'admin' && (
            <div className="mt-3">
              <select
                value={selectedUserFilter}
                onChange={(e) => setSelectedUserFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">All Users</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>{user.username}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Create Report Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-bold mb-4">Create Service Report</h3>
            
            <form onSubmit={handleCreateReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                  required
                >
                  <option value="URGENT">URGENT</option>
                  <option value="SAME WEEK">SAME WEEK</option>
                  <option value="NEXT WEEK">NEXT WEEK</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  readOnly
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg bg-gray-100 h-24 sm:h-32 resize-none text-sm sm:text-base cursor-not-allowed"
                  placeholder="Describe the maintenance issue..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photos ({photos.length}/5)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                />
                
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-20 sm:h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Videos ({videos.length}/2)
                </label>
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  capture="environment"
                  onChange={handleVideoUpload}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                />
                
                {videos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                    {videos.map((video, index) => (
                      <div key={index} className="relative">
                        <video
                          src={video}
                          className="w-full h-32 object-cover rounded-lg"
                          controls
                          preload="metadata"
                        />
                        <button
                          type="button"
                          onClick={() => removeVideo(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Report'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="w-full sm:flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Report Modal */}
      {showEditForm && editingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
            <h3 className="text-xl sm:text-2xl font-bold mb-4">Edit Service Report</h3>
            
            <form onSubmit={handleUpdateReport} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  disabled={editingReport?.status === 'reported'}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base ${
                    editingReport?.status === 'reported' ? 'bg-gray-100 cursor-not-allowed' : ''
                  }`}
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} - {client.address}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                  required
                >
                  <option value="URGENT">URGENT</option>
                  <option value="SAME WEEK">SAME WEEK</option>
                  <option value="NEXT WEEK">NEXT WEEK</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 sm:h-32 resize-none text-sm sm:text-base"
                  placeholder="Describe the maintenance issue..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee Notes</label>
                <textarea
                  value={employeeNotes}
                  onChange={(e) => setEmployeeNotes(e.target.value)}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none text-sm sm:text-base"
                  placeholder="Add any additional notes..."
                />
              </div>

              {user?.role === 'admin' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes</label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-20 resize-none text-sm sm:text-base"
                      placeholder="Admin notes..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Estimate ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={totalCost}
                        onChange={(e) => {
                          setTotalCost(e.target.value);
                          if (partsCost && e.target.value) {
                            setGrossProfit((parseFloat(e.target.value) - parseFloat(partsCost)).toFixed(2));
                          }
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cost of Services ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={partsCost}
                        onChange={(e) => {
                          setPartsCost(e.target.value);
                          if (totalCost && e.target.value) {
                            setGrossProfit((parseFloat(totalCost) - parseFloat(e.target.value)).toFixed(2));
                          }
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Gross Profit ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={grossProfit}
                        readOnly
                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg bg-gray-100 text-sm sm:text-base"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Photos ({photos.length}/5)
                </label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoUpload}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                />
                
                {photos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-20 sm:h-24 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {isLoading ? 'Updating...' : 'Update Report'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditForm(false);
                    resetForm();
                  }}
                  className="w-full sm:flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-4 sm:space-y-6">
        {filteredReports.map(report => (
          <div key={report.id} className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {getReportFlag(report) && (
                    <span className="text-lg">{getReportFlag(report)}</span>
                  )}
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{report.client_name}</h3>
                </div>
                {report.client_address && (
                  <p className="text-xs sm:text-sm text-gray-500">{report.client_address}</p>
                )}
                <p className="text-gray-600 text-sm sm:text-base">By: {report.employee_name}</p>
                <p className="text-xs sm:text-sm text-gray-500">
                  Created: {formatLATime(report.request_date)} at {formatLATimeOnly(report.request_date)}
                </p>
                {report.last_modified && (
                  <p className="text-xs text-gray-400">
                    Last modified: {formatLADateTime(report.last_modified)}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getPriorityColor(report.priority)}`}>
                  {report.priority}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(report.status)}`}>
                  {report.status.replace('_', ' ').toUpperCase()}
                  {report.status === 'reported' && (
                    <span className="ml-2 text-xs">
                      {formatLADateTime(report.request_date)}
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
              <p className="text-gray-700 text-sm sm:text-base">{report.description}</p>
            </div>

            {report.employee_notes && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-1">Employee Notes:</p>
                <p className="text-blue-700 text-sm">{report.employee_notes}</p>
              </div>
            )}

            {/* Admin Notes for Users (Read-only) */}
            {report.admin_notes && user?.role !== 'admin' && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-1">Admin Notes:</p>
                <p className="text-green-700 text-sm">{report.admin_notes}</p>
              </div>
            )}

            {report.photos && report.photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4">
                {report.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Report photo ${index + 1}`}
                    className="w-full h-20 sm:h-24 object-cover rounded-lg cursor-pointer hover:opacity-80"
                    onClick={() => openMediaViewer(photo, 'image')}
                  />
                ))}
              </div>
            )}

            {report.videos && report.videos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {report.videos.map((video, index) => (
                  <video
                    key={index}
                    src={video}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80"
                    onClick={() => openMediaViewer(video, 'video')}
                  />
                ))}
              </div>
            )}

            {/* Edit Button */}
            {(user?.role === 'admin' || report.employee_id === user?.id) && (
              <div className="mb-4">
                <button
                  onClick={() => handleEditReport(report)}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm"
                >
                  Edit Report
                </button>
              </div>
            )}

            {/* Media Viewer Modal */}

            {/* Modification History (for all users) */}
            {(user?.role !== 'admin') && report.modification_history && report.modification_history.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Service History:</p>
                <div className="space-y-1">
                  {report.modification_history.map((mod, index) => (
                    <p key={index} className="text-xs text-gray-600">
                      {formatLADateTime(mod.modified_at)} - Modified by {mod.modified_by} ({mod.modified_by_role}): {mod.changes.join(', ')}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Controls */}
            {user?.role === 'admin' && (
              <div className="border-t pt-4 mt-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {['scheduled', 'in_progress', 'completed'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateReportStatus(report.id, status)}
                      className={`px-3 py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
                        report.status === status
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                      }`}
                    >
                      {status.replace('_', ' ').toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Financial Fields */}
                <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-3">Financial Information:</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Estimate ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={report.total_cost || ''}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          const updatedReports = filteredReports.map(r => 
                            r.id === report.id ? { ...r, total_cost: parseFloat(newValue) || 0 } : r
                          );
                          setFilteredReports(updatedReports);
                          
                          clearTimeout(window.financialTimeout);
                          window.financialTimeout = setTimeout(() => {
                            updateFinancialField(report.id, 'total_cost', parseFloat(newValue) || 0);
                          }, 1000);
                        }}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Est. Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={report.parts_cost || ''}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          const updatedReports = filteredReports.map(r => 
                            r.id === report.id ? { ...r, parts_cost: parseFloat(newValue) || 0 } : r
                          );
                          setFilteredReports(updatedReports);
                          
                          clearTimeout(window.financialTimeout);
                          window.financialTimeout = setTimeout(() => {
                            updateFinancialField(report.id, 'parts_cost', parseFloat(newValue) || 0);
                          }, 1000);
                        }}
                        className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-blue-700 mb-1">Gross Profit ($)</label>
                      <input
                        type="text"
                        value={`${formatCurrency((report.total_cost || 0) - (report.parts_cost || 0))}`}
                        readOnly
                        className="w-full px-2 py-1 border border-blue-300 rounded bg-blue-100 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Admin Notes:</label>
                  <textarea
                    value={report.admin_notes || ''}
                    onChange={(e) => {
                      // Update the local state immediately for better UX
                      const updatedReports = filteredReports.map(r => 
                        r.id === report.id ? { ...r, admin_notes: e.target.value } : r
                      );
                      setFilteredReports(updatedReports);
                      
                      // Auto-save notes after user stops typing
                      clearTimeout(window.notesTimeout);
                      window.notesTimeout = setTimeout(() => {
                        updateAdminNotes(report.id, e.target.value);
                      }, 1000);
                    }}
                    placeholder="Admin notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm h-20"
                    rows="2"
                  />
                </div>

                {/* Service History moved here */}
                {report.modification_history && report.modification_history.length > 0 && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Service History:</p>
                    <div className="space-y-1">
                      {report.modification_history.map((mod, index) => (
                        <p key={index} className="text-xs text-gray-600">
                          {formatLADateTime(mod.modified_at)} - Modified by {mod.modified_by} ({mod.modified_by_role}): {mod.changes.join(', ')}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl sm:text-6xl mb-4">🏊‍♂️</div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">No service reports yet</h3>
          <p className="text-gray-600 text-sm sm:text-base px-4">
            {user?.role === 'employee' 
              ? 'Create your first service report to get started!'
              : 'No service reports have been created yet.'
            }
          </p>
        </div>
      )}
      
      {/* Media Viewer Modal */}
      {showMediaViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50" onClick={closeMediaViewer}>
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeMediaViewer}
              className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10"
            >
              ✕
            </button>
            {currentMedia.type === 'image' ? (
              <img
                src={currentMedia.src}
                alt="Full screen view - Click to close"
                className="max-w-full max-h-full object-contain cursor-pointer"
                onClick={closeMediaViewer}
              />
            ) : (
              <video
                src={currentMedia.src}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
const ServicesConcluded = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [filteredReports, setFilteredReports] = useState([]);
  const [clients, setClients] = useState([]);
  const [searchClient, setSearchClient] = useState('');
  const [searchEmployee, setSearchEmployee] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [currentMedia, setCurrentMedia] = useState({ src: '', type: '' });

  const updateAdminNotes = async (reportId, notes) => {
    try {
      await axios.put(`${API}/reports/${reportId}`, {
        admin_notes: notes
      });
      fetchCompletedReports();
    } catch (error) {
      console.error('Failed to update admin notes:', error);
    }
  };

  const openMediaViewer = (src, type) => {
    setCurrentMedia({ src, type });
    setShowMediaViewer(true);
  };

  const closeMediaViewer = () => {
    setShowMediaViewer(false);
    setCurrentMedia({ src: '', type: '' });
  };

  useEffect(() => {
    fetchCompletedReports();
    fetchClients();
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, []);

  useEffect(() => {
    filterReports();
  }, [reports, searchClient, searchEmployee]);

  const filterReports = () => {
    let filtered = reports;
    
    if (searchClient) {
      filtered = filtered.filter(report => 
        report.client_name === searchClient
      );
    }
    
    if (searchEmployee) {
      filtered = filtered.filter(report => 
        report.employee_name.toLowerCase().includes(searchEmployee.toLowerCase())
      );
    }
    
    setFilteredReports(filtered);
  };

  const fetchCompletedReports = async () => {
    try {
      const response = await axios.get(`${API}/reports`);
      // Filter only completed reports
      const completedReports = response.data.filter(report => report.status === 'completed');
      setReports(completedReports);
    } catch (error) {
      console.error('Failed to fetch completed reports:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.role === 'employee'));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const deleteReport = async (reportId) => {
    if (window.confirm('Are you sure you want to delete this completed report? This action cannot be undone.')) {
      try {
        await axios.delete(`${API}/reports/${reportId}`);
        fetchCompletedReports();
        alert('Report deleted successfully');
      } catch (error) {
        console.error('Failed to delete report:', error);
        alert('Failed to delete report');
      }
    }
  };

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const getStatusColor = (status) => {
    return 'bg-green-100 text-green-800'; // All concluded are completed
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'URGENT': 'bg-red-100 text-red-800',
      'SAME WEEK': 'bg-orange-100 text-orange-800',
      'NEXT WEEK': 'bg-blue-100 text-blue-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex-1">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Services Completed</h2>
          <div className="text-sm text-gray-600 mt-1">
            Total completed: {filteredReports.length}
          </div>
        </div>
        
        {/* Search Filters - Change employee search to dropdown for admin */}
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select
            value={searchClient}
            onChange={(e) => setSearchClient(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Clients</option>
            {clients.map(client => (
              <option key={client.id} value={client.name}>
                {client.name}
              </option>
            ))}
          </select>
          {user?.role === 'admin' && (
            <select
              value={searchEmployee}
              onChange={(e) => setSearchEmployee(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Employees</option>
              {users.map(user => (
                <option key={user.id} value={user.username}>{user.username}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4 sm:space-y-6">
        {filteredReports.map(report => (
          <div key={report.id} className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border-l-4 border-green-500">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{report.client_name}</h3>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => deleteReport(report.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete Report"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-row items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getPriorityColor(report.priority)}`}>
                      {report.priority}
                    </span>
                    <div className="flex flex-col items-center space-y-1">
                      <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStatusColor(report.status)}`}>
                        COMPLETED
                      </span>
                      {report.completion_date && (
                        <span className="text-xs text-green-600 font-medium">
                          {formatLATime(report.completion_date)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {report.client_address && (
                  <p className="text-xs sm:text-sm text-gray-500">{report.client_address}</p>
                )}
                <p className="text-gray-600 text-sm sm:text-base">By: {report.employee_name}</p>
                <p className="text-xs sm:text-sm text-gray-500">
                  Created: {formatLATime(report.request_date)} at {formatLATimeOnly(report.request_date)}
                </p>
                {report.last_modified && (
                  <p className="text-xs text-gray-400">
                    Last modified: {formatLADateTime(report.last_modified)}
                  </p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
              <p className="text-gray-700 text-sm sm:text-base">{report.description}</p>
            </div>

            {report.employee_notes && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-1">Employee Notes:</p>
                <p className="text-blue-700 text-sm">{report.employee_notes}</p>
              </div>
            )}

            {/* Financial Information (Admin Only) */}
            {user?.role === 'admin' && (report.total_cost > 0 || report.parts_cost > 0) && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-800 mb-2">Financial Summary:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Estimate: </span>
                    <span className="font-medium">${formatCurrency(report.total_cost || 0)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Cost of Services: </span>
                    <span className="font-medium">${formatCurrency(report.parts_cost || 0)}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Gross Profit: </span>
                    <span className="font-medium">${formatCurrency((report.total_cost || 0) - (report.parts_cost || 0))}</span>
                  </div>
                </div>
              </div>
            )}

            {report.photos && report.photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-4">
                {report.photos.map((photo, index) => (
                  <img
                    key={index}
                    src={photo}
                    alt={`Report photo ${index + 1}`}
                    className="w-full h-20 sm:h-24 object-cover rounded-lg cursor-pointer hover:opacity-80"
                    onClick={() => openMediaViewer(photo, 'image')}
                  />
                ))}
              </div>
            )}

            {/* Admin Notes for Admin (with all data) */}
            {user?.role === 'admin' && report.admin_notes && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-800 mb-1">Admin Notes:</p>
                <p className="text-green-700 text-sm">{report.admin_notes}</p>
              </div>
            )}

            {/* Modification History */}
            {report.modification_history && report.modification_history.length > 0 && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Service History:</p>
                <div className="space-y-1">
                  {report.modification_history.map((mod, index) => (
                    <p key={index} className="text-xs text-gray-600">
                      {formatLADateTime(mod.modified_at)} - Modified by {mod.modified_by} ({mod.modified_by_role}): {mod.changes.join(', ')}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl sm:text-6xl mb-4">✅</div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">
            {reports.length === 0 ? 'No completed services yet' : 'No services match your search'}
          </h3>
          <p className="text-gray-600 text-sm sm:text-base px-4">
            {reports.length === 0 
              ? 'Completed service reports will appear here.'
              : 'Try adjusting your search criteria.'
            }
          </p>
        </div>
      )}
      
      {/* Media Viewer Modal */}
      {showMediaViewer && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50" onClick={closeMediaViewer}>
          <div className="relative max-w-4xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={closeMediaViewer}
              className="absolute -top-10 right-0 text-white text-2xl hover:text-gray-300 z-10"
            >
              ✕
            </button>
            {currentMedia.type === 'image' ? (
              <img
                src={currentMedia.src}
                alt="Full screen view - Click to close"
                className="max-w-full max-h-full object-contain cursor-pointer"
                onClick={closeMediaViewer}
              />
            ) : (
              <video
                src={currentMedia.src}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
const ClientsManagement = () => {
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', address: '', employee_id: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [filteredClients, setFilteredClients] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    fetchClients();
    if (user?.role === 'admin') {
      fetchUsers();
    }
  }, []);

  useEffect(() => {
    if (employeeFilter === '') {
      setFilteredClients(clients);
    } else if (employeeFilter === 'unassigned') {
      setFilteredClients(clients.filter(client => !client.employee_id));
    } else {
      setFilteredClients(clients.filter(client => client.employee_id === employeeFilter));
    }
  }, [clients, employeeFilter]);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data.filter(u => u.role === 'employee'));
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (user?.role === 'admin' && !selectedUser) {
      alert('Please select a user to import clients for');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (user?.role === 'admin' && selectedUser) {
      formData.append('employee_id', selectedUser);
    }

    try {
      const response = await axios.post(`${API}/clients/import-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(response.data.message);
      fetchClients();
      setShowUpload(false);
      setSelectedUser('');
    } catch (error) {
      console.error('Failed to upload Excel:', error);
      alert('Failed to import Excel file. Make sure it has "Name" and "Address" columns.');
    }
    setIsUploading(false);
  };

  const deleteClient = async (clientId, clientName) => {
    if (window.confirm(`Are you sure you want to delete client "${clientName}"?`)) {
      try {
        await axios.delete(`${API}/clients/${clientId}`);
        fetchClients();
        alert('Client deleted successfully');
      } catch (error) {
        console.error('Failed to delete client:', error);
        alert('Failed to delete client');
      }
    }
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClient.name.trim() || !newClient.address.trim()) {
      alert('Please fill in both name and address');
      return;
    }

    setIsCreating(true);
    try {
      // Check for duplicate by name only
      const duplicate = clients.find(client => 
        client.name.toLowerCase().trim() === newClient.name.toLowerCase().trim()
      );
      
      if (duplicate) {
        const proceed = window.confirm(`A client with the name "${newClient.name}" already exists.\n\nExisting client: ${duplicate.name} - ${duplicate.address}\nNew client: ${newClient.name} - ${newClient.address}\n\nDo you want to continue?`);
        if (!proceed) {
          setIsCreating(false);
          return;
        }
      }

      await axios.post(`${API}/clients`, {
        name: newClient.name.trim(),
        address: newClient.address.trim(),
        employee_id: newClient.employee_id || null
      });
      
      fetchClients();
      setShowAddClient(false);
      setNewClient({ name: '', address: '', employee_id: '' });
      alert('Client created successfully!');
    } catch (error) {
      console.error('Failed to create client:', error);
      alert('Failed to create client');
    }
    setIsCreating(false);
  };

  const getEmployeeName = (employeeId) => {
    if (!employeeId) return 'Unassigned';
    const employee = users.find(u => u.id === employeeId);
    return employee ? employee.username : 'Unknown';
  };

  const getEmployeeClientCount = (employeeId) => {
    return clients.filter(client => client.employee_id === employeeId).length;
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Clients Management</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowUpload(true)}
            className="flex-1 sm:w-auto bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-full text-xs font-medium transition"
          >
            📊 Import Excel
          </button>
          <button
            onClick={() => setShowAddClient(true)}
            className="flex-1 sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-full text-xs font-medium transition"
          >
            ➕ Add Customer
          </button>
        </div>
      </div>

      {/* Employee Filter */}
      {user?.role === 'admin' && (
        <div className="mb-6">
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="">All Employees</option>
            <option value="unassigned">Unassigned Clients</option>
            {users.filter(u => u.role === 'employee').map(employee => (
              <option key={employee.id} value={employee.id}>{employee.username}</option>
            ))}
          </select>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg sm:text-xl font-bold mb-4">Import Clients from Excel</h3>
            <p className="text-gray-600 mb-4 text-sm sm:text-base">
              Excel file should have columns named "Name" and "Address"
            </p>
            
            {user?.role === 'admin' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to User:</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  required
                >
                  <option value="">Select a user</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                  ))}
                </select>
              </div>
            )}
            
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelUpload}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none mb-4 text-sm sm:text-base"
              disabled={isUploading}
            />
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
              <button
                onClick={() => setShowUpload(false)}
                disabled={isUploading}
                className="w-full sm:flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
            {isUploading && (
              <div className="mt-4 text-center text-blue-600 text-sm">
                Uploading and processing...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg sm:text-xl font-bold mb-4">Add New Customer</h3>
            
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Customer Name</label>
                <input
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                  placeholder="Enter customer name"
                  required
                  disabled={isCreating}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                <input
                  type="text"
                  value={newClient.address}
                  onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                  placeholder="Enter customer address"
                  required
                  disabled={isCreating}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Employee (Optional)</label>
                <select
                  value={newClient.employee_id}
                  onChange={(e) => setNewClient({...newClient, employee_id: e.target.value})}
                  className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                  disabled={isCreating}
                >
                  <option value="">No specific employee</option>
                  {users.filter(u => u.role === 'employee').map(employee => (
                    <option key={employee.id} value={employee.id}>{employee.username}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddClient(false);
                    setNewClient({ name: '', address: '', employee_id: '' });
                  }}
                  disabled={isCreating}
                  className="w-full sm:flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Clients List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600">Name</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600 hidden sm:table-cell">Address</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600 hidden sm:table-cell">Employee</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600 hidden sm:table-cell">Added</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredClients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <div>
                      <div className="font-medium text-gray-800 text-sm sm:text-base">{client.name}</div>
                      <div className="text-xs text-gray-500 sm:hidden">{client.address}</div>
                      <div className="text-xs text-gray-400 sm:hidden">{formatLATime(client.created_at)}</div>
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-gray-600 text-sm sm:text-base hidden sm:table-cell">{client.address}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                    <div>
                      <div className="font-medium">{getEmployeeName(client.employee_id)}</div>
                      {client.employee_id && (
                        <div className="text-xs text-gray-400">
                          Total: {getEmployeeClientCount(client.employee_id)} clients
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500 hidden sm:table-cell">
                    {formatLATime(client.created_at)}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-center">
                    <button
                      onClick={() => deleteClient(client.id, client.name)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="Delete Client"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredClients.length === 0 && clients.length > 0 && (
        <div className="text-center py-12">
          <div className="text-4xl sm:text-6xl mb-4">🔍</div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">No clients found</h3>
          <p className="text-gray-600 text-sm sm:text-base px-4">Try changing the employee filter to see more clients.</p>
        </div>
      )}

      {clients.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl sm:text-6xl mb-4">👥</div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">No clients yet</h3>
          <p className="text-gray-600 text-sm sm:text-base px-4">Import your client list from Excel to get started!</p>
        </div>
      )}
    </div>
  );
};

// Users Management Component
const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'employee'
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await axios.post(`${API}/users`, formData);
      setShowCreateForm(false);
      setFormData({ username: '', password: '', role: 'employee' });
      fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
      alert('Failed to create user. Username might already exist.');
    }
    setIsLoading(false);
  };

  const deleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`${API}/users/${userId}`);
        fetchUsers();
      } catch (error) {
        console.error('Failed to delete user:', error);
        alert('Failed to delete user');
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">User Management</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-6 py-3 rounded-lg font-semibold transition"
        >
          Add User
        </button>
      </div>

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md">
            <h3 className="text-lg sm:text-xl font-bold mb-4">Create New User</h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <input
                type="text"
                placeholder="Username"
                value={formData.username}
                onChange={(e) => setFormData({...formData, username: e.target.value})}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                required
              />
              
              <input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
                required
              />
              
              <select
                value={formData.role}
                onChange={(e) => setFormData({...formData, role: e.target.value})}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm sm:text-base"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>

              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create User'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="w-full sm:flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-3 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600">Username</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600">Role</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600">Created</th>
                <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-xs sm:text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-6 py-3 sm:py-4 font-medium text-gray-800 text-sm sm:text-base">{user.username}</td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-500">
                    {formatLATime(user.created_at)}
                  </td>
                  <td className="px-3 sm:px-6 py-3 sm:py-4">
                    {user.username !== 'admin' && (
                      <button
                        onClick={() => deleteUser(user.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Calendar Component with Gross Profit
const Calendar = () => {
  const [monthlyData, setMonthlyData] = useState({});
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchYearlyData();
  }, [selectedYear]);

  const fetchYearlyData = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API}/reports`);
      const completedReports = response.data.filter(report => 
        report.status === 'completed' && 
        report.last_modified &&
        new Date(report.last_modified).getFullYear() === selectedYear
      );

      const monthData = {};
      
      // Initialize all months
      for (let month = 0; month < 12; month++) {
        monthData[month] = {};
        const daysInMonth = new Date(selectedYear, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          monthData[month][day] = 0;
        }
      }

      // Calculate daily profits using last_modified date
      completedReports.forEach(report => {
        if (report.last_modified && report.total_cost && report.parts_cost) {
          const date = moment.utc(report.last_modified).tz('America/Los_Angeles').toDate();
          const month = date.getMonth();
          const day = date.getDate();
          const profit = (report.total_cost || 0) - (report.parts_cost || 0);
          
          if (monthData[month] && monthData[month][day] !== undefined) {
            monthData[month][day] += profit;
          }
        }
      });

      setMonthlyData(monthData);
    } catch (error) {
      console.error('Failed to fetch yearly data:', error);
    }
    setIsLoading(false);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDayOfWeek = (year, month, day) => {
    return new Date(year, month, day).getDay();
  };

  const renderMonth = (monthIndex) => {
    const daysInMonth = new Date(selectedYear, monthIndex + 1, 0).getDate();
    const firstDayOfWeek = getDayOfWeek(selectedYear, monthIndex, 1);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-16"></div>);
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayOfWeek = getDayOfWeek(selectedYear, monthIndex, day);
      const profit = monthlyData[monthIndex]?.[day] || 0;
      const isSunday = dayOfWeek === 0;

      days.push(
        <div
          key={day}
          className={`h-16 border border-gray-200 p-1 flex flex-col justify-between ${
            isSunday ? 'bg-red-50' : 'bg-white'
          } hover:bg-gray-50 transition-colors`}
        >
          <div className={`text-sm font-medium ${isSunday ? 'text-red-600' : 'text-gray-800'}`}>
            {day}
          </div>
          {profit > 0 && (
            <div className="text-xs text-green-600 font-medium">
              ${formatCurrency(profit)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
          {monthNames[monthIndex]} {selectedYear}
        </h3>
        
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-sm font-medium text-gray-600 bg-gray-100">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0 border border-gray-200">
          {days}
        </div>
      </div>
    );
  };

  const calculateYearlyTotal = () => {
    let total = 0;
    Object.values(monthlyData).forEach(month => {
      Object.values(month).forEach(dayProfit => {
        total += dayProfit;
      });
    });
    return total;
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Profit Calendar</h2>
          <p className="text-gray-600 mt-1">Daily gross profit from completed services</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold text-green-600">
            Gross Profit: ${formatCurrency(calculateYearlyTotal())}
          </div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Months</option>
            {monthNames.map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-xl text-gray-600">Loading calendar data...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {selectedMonth === 'all' 
            ? monthNames.map((_, index) => renderMonth(index))
            : [renderMonth(parseInt(selectedMonth))]
          }
        </div>
      )}
      
      <div className="mt-6 text-center text-sm text-gray-500">
        <p>Red background indicates Sundays. Gross profit shown for days with completed services.</p>
      </div>
    </div>
  );
};

const ReportsDownload = () => {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchEmployees();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API}/users`);
      setEmployees(response.data.filter(u => u.role === 'employee'));
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  };

  const generateReport = async () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }

    setIsGenerating(true);
    try {
      console.log('Fetching reports...');
      const response = await axios.get(`${API}/reports`);
      const allReports = response.data;
      console.log('All reports:', allReports.length);
      
      // Filter completed reports by date and other criteria
      let reports = allReports.filter(report => {
        if (report.status !== 'completed') return false;
        
        const reportDate = new Date(report.completion_date || report.request_date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        return reportDate >= start && reportDate <= end;
      });
      
      console.log('Completed reports in date range:', reports.length);
      
      // Apply client filter
      if (selectedClient && selectedClient !== 'all' && selectedClient !== '') {
        reports = reports.filter(report => report.client_name === selectedClient);
        console.log('After client filter:', reports.length);
      }
      
      // Apply employee filter  
      if (selectedEmployee && selectedEmployee !== 'all' && selectedEmployee !== '') {
        reports = reports.filter(report => report.employee_id === selectedEmployee);
        console.log('After employee filter:', reports.length);
      }

      if (reports.length === 0) {
        alert('No completed reports found for the selected criteria');
        setIsGenerating(false);
        return;
      }

      console.log('Generating PDF with', reports.length, 'reports');
      // Generate PDF with photos
      await generatePDF(reports, startDate, endDate);
      console.log('PDF generated successfully');

    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report');
    }
    setIsGenerating(false);
  };

  const generatePDF = async (reports, startDate, endDate) => {
    try {
      console.log('Starting enhanced PDF generation...');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      console.log('PDF instance created');
      
      // Enhanced header with background
      pdf.setFillColor(41, 128, 185); // Professional blue
      pdf.rect(0, 0, pageWidth, 35, 'F');
      
      // Title
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont(undefined, 'bold');
      pdf.text('SERVICE REPORTS - COMPLETED', pageWidth / 2, 15, { align: 'center' });
      
      // Subtitle
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'normal');
      pdf.text(`Period: ${startDate} to ${endDate} | Total: ${reports.length} reports`, pageWidth / 2, 25, { align: 'center' });
      
      let yPosition = 45;
      let reportsPerPage = 0;
      const maxReportsPerPage = 3; // Fit 3 reports per page
      
      for (let i = 0; i < reports.length; i++) {
        const report = reports[i];
        console.log(`Processing report ${i + 1}:`, report.client_name);
        
        // Check if we need a new page
        if (reportsPerPage >= maxReportsPerPage || yPosition > pageHeight - 100) {
          pdf.addPage();
          yPosition = 20;
          reportsPerPage = 0;
        }
        
        // Report container with border
        const containerHeight = 85;
        pdf.setFillColor(248, 249, 250);
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineWidth(0.5);
        pdf.roundedRect(10, yPosition - 5, pageWidth - 20, containerHeight, 3, 3, 'FD');
        
        // Report header with colored background
        pdf.setFillColor(52, 152, 219);
        pdf.roundedRect(12, yPosition - 3, pageWidth - 24, 12, 2, 2, 'F');
        
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(12);
        pdf.setFont(undefined, 'bold');
        pdf.text(`#${i + 1} ${report.client_name}`, 15, yPosition + 5);
        
        // Priority badge
        const priorityColors = {
          'URGENT': [231, 76, 60],
          'SAME WEEK': [243, 156, 18],
          'NEXT WEEK': [46, 204, 113]
        };
        const priorityColor = priorityColors[report.priority] || [149, 165, 166];
        pdf.setFillColor(...priorityColor);
        pdf.roundedRect(pageWidth - 45, yPosition - 2, 32, 8, 2, 2, 'F');
        pdf.setFontSize(8);
        pdf.setFont(undefined, 'bold');
        pdf.text(report.priority, pageWidth - 29, yPosition + 3, { align: 'center' });
        
        yPosition += 15;
        
        // Two-column layout for report details
        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        
        // Left column
        const leftColX = 15;
        const rightColX = pageWidth / 2 + 5;
        let leftY = yPosition;
        let rightY = yPosition;
        
        // Left column data
        const leftData = [
          { label: 'Date:', value: formatLATime(report.completion_date || report.request_date) },
          { label: 'Address:', value: report.client_address || 'N/A' },
          { label: 'Employee:', value: report.employee_name || 'N/A' }
        ];
        
        leftData.forEach(item => {
          pdf.setFont(undefined, 'bold');
          pdf.text(item.label, leftColX, leftY);
          pdf.setFont(undefined, 'normal');
          pdf.text(item.value, leftColX + 25, leftY);
          leftY += 7;
        });
        
        // Right column - Financial data
        if (report.total_cost || report.parts_cost) {
          const financialData = [
            { label: 'Total:', value: `$${formatCurrency(report.total_cost || 0)}` },
            { label: 'Parts:', value: `$${formatCurrency(report.parts_cost || 0)}` },
            { label: 'Profit:', value: `$${formatCurrency((report.total_cost || 0) - (report.parts_cost || 0))}` }
          ];
          
          financialData.forEach(item => {
            pdf.setFont(undefined, 'bold');
            pdf.text(item.label, rightColX, rightY);
            pdf.setFont(undefined, 'normal');
            pdf.text(item.value, rightColX + 25, rightY);
            rightY += 7;
          });
        }
        
        // Description section
        yPosition = Math.max(leftY, rightY) + 3;
        pdf.setFont(undefined, 'bold');
        pdf.text('Description:', leftColX, yPosition);
        pdf.setFont(undefined, 'normal');
        
        // Wrap description text
        const descText = report.description || 'N/A';
        const wrappedDesc = pdf.splitTextToSize(descText, pageWidth - 40);
        pdf.text(wrappedDesc.slice(0, 2), leftColX, yPosition + 6); // Limit to 2 lines
        
        yPosition += (wrappedDesc.length > 2 ? 18 : 12);
        
        // Notes section (compact)
        if (report.admin_notes || report.employee_notes) {
          pdf.setFontSize(8);
          if (report.admin_notes) {
            pdf.setFont(undefined, 'bold');
            pdf.text('Admin:', leftColX, yPosition);
            pdf.setFont(undefined, 'normal');
            const adminText = pdf.splitTextToSize(report.admin_notes, 80);
            pdf.text(adminText.slice(0, 1), leftColX + 20, yPosition);
            yPosition += 6;
          }
          if (report.employee_notes) {
            pdf.setFont(undefined, 'bold');
            pdf.text('Employee:', leftColX, yPosition);
            pdf.setFont(undefined, 'normal');
            const empText = pdf.splitTextToSize(report.employee_notes, 80);
            pdf.text(empText.slice(0, 1), leftColX + 25, yPosition);
            yPosition += 6;
          }
        }
        
        // Compact photos section
        if (report.photos && report.photos.length > 0) {
          const photoStartX = rightColX;
          const photoY = yPosition - 35;
          const photoSize = 20; // Smaller photos
          const maxPhotos = 4; // Max 4 photos to save space
          
          pdf.setFontSize(8);
          pdf.setFont(undefined, 'bold');
          pdf.text(`Photos (${Math.min(report.photos.length, maxPhotos)}):`, photoStartX, photoY - 5);
          
          for (let j = 0; j < Math.min(report.photos.length, maxPhotos); j++) {
            try {
              const photoData = report.photos[j];
              const col = j % 2;
              const row = Math.floor(j / 2);
              const x = photoStartX + col * (photoSize + 3);
              const y = photoY + row * (photoSize + 3);
              
              pdf.addImage(photoData, 'JPEG', x, y, photoSize, photoSize);
              
              // Photo number
              pdf.setFontSize(6);
              pdf.setTextColor(255, 255, 255);
              pdf.setFillColor(0, 0, 0, 0.7);
              pdf.circle(x + 2, y + 2, 1.5, 'F');
              pdf.text(`${j + 1}`, x + 2, y + 3, { align: 'center' });
              pdf.setTextColor(0, 0, 0);
              
            } catch (error) {
              console.warn(`Failed to add photo ${j + 1}:`, error);
            }
          }
          
          if (report.photos.length > maxPhotos) {
            pdf.setFontSize(7);
            pdf.text(`+${report.photos.length - maxPhotos} more`, photoStartX, photoY + 45);
          }
        }
        
        yPosition += containerHeight + 10;
        reportsPerPage++;
      }
      
      // Footer
      const totalPages = pdf.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.text(`Page ${p} of ${totalPages}`, pageWidth - 20, pageHeight - 5, { align: 'right' });
        pdf.text('Generated by Pool Maintenance System', 10, pageHeight - 5);
      }
      
      // Save the PDF
      const fileName = `service_reports_${startDate}_to_${endDate}.pdf`;
      pdf.save(fileName);
      console.log('Enhanced PDF saved successfully:', fileName);
      
    } catch (error) {
      console.error('Error in generatePDF:', error);
      throw error;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6">
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Reports Download</h2>
        <p className="text-gray-600 mt-1">Download completed service reports as PDF with photos</p>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Filter Options</h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Client</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Clients</option>
              <option value="all">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.name}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">All Employees</option>
              <option value="all">All Employees</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>
                  {employee.username}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex justify-center">
          <button
            onClick={generateReport}
            disabled={isGenerating}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-semibold transition flex items-center space-x-2"
          >
            {isGenerating ? (
              <>
                <span>📄</span>
                <span>Generate PDF...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>Download PDF Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-800 mb-2">PDF Report Contents:</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Date Completed</li>
          <li>• Client Information (Name, Address)</li>
          <li>• Employee Name</li>
          <li>• Priority Level</li>
          <li>• Service Description</li>
          <li>• Financial Details (Total Cost, Parts Cost, Gross Profit)</li>
          <li>• Admin and Employee Notes</li>
          <li>• Photos included in high quality</li>
          <li>• Professional PDF formatting with each report on separate sections</li>
        </ul>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('reports');

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main>
        {activeTab === 'reports' && <ServiceReports />}
        {activeTab === 'completed' && <ServicesConcluded />}
        {activeTab === 'clients' && user?.role === 'admin' && <ClientsManagement />}
        {activeTab === 'users' && user?.role === 'admin' && <UsersManagement />}
        {activeTab === 'calendar' && user?.role === 'admin' && <Calendar />}
        {activeTab === 'reports-download' && user?.role === 'admin' && <ReportsDownload />}
      </main>
    </div>
  );
};

// Main App Component
function App() {
  const { user } = useAuth();

  return (
    <div className="App">
      {user ? <Dashboard /> : <Login />}
    </div>
  );
}

// App with Auth Provider
export default function AppWithAuth() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}