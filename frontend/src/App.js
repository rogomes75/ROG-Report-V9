import React, { useState, useEffect } from 'react';
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

// Utility function to format LA time
const formatLATime = (date) => {
  return moment.utc(date).tz('America/Los_Angeles').format('MM/DD/YYYY');
};

const formatLADateTime = (date) => {
  return moment.utc(date).tz('America/Los_Angeles').format('MM/DD/YYYY hh:mm A');
};

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

// Priority styles
const getPriorityStyle = (priority) => {
  switch(priority) {
    case 'URGENT':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'SAME_WEEK':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'NEXT_WEEK':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-green-100 text-green-800 border-green-200';
  }
};

// Status styles
const getStatusStyle = (status) => {
  switch(status) {
    case 'completed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'scheduled':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

function App() {
  const [clients, setClients] = useState([]);
  const [reports, setReports] = useState([]);
  const [currentView, setCurrentView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [clientForm, setClientForm] = useState({
    name: '', address: '', phone: '', email: ''
  });
  const [reportForm, setReportForm] = useState({
    client_id: '', title: '', description: '', priority: 'NORMAL'
  });
  const [editingReport, setEditingReport] = useState(null);

  // Fetch data
  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`);
      setClients(response.data);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setError('Error loading clients');
    }
  };

  const fetchReports = async () => {
    try {
      const response = await axios.get(`${API}/reports`);
      setReports(response.data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      setError('Error loading reports');
    }
  };

  useEffect(() => {
    fetchClients();
    fetchReports();
  }, []);

  // Create client
  const handleCreateClient = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/clients`, clientForm);
      setClientForm({ name: '', address: '', phone: '', email: '' });
      fetchClients();
      setCurrentView('clients');
    } catch (error) {
      console.error('Error creating client:', error);
      setError('Error creating client');
    }
    setLoading(false);
  };

  // Create report
  const handleCreateReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/reports`, reportForm);
      setReportForm({ client_id: '', title: '', description: '', priority: 'NORMAL' });
      fetchReports();
      setCurrentView('reports');
    } catch (error) {
      console.error('Error creating report:', error);
      setError('Error creating report');
    }
    setLoading(false);
  };

  // Update report
  const handleUpdateReport = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API}/reports/${editingReport.id}`, editingReport);
      setEditingReport(null);
      fetchReports();
    } catch (error) {
      console.error('Error updating report:', error);
      setError('Error updating report');
    }
    setLoading(false);
  };

  // Generate PDF report
  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.text('ROG Pool Service - Service Reports', 20, 20);
    
    // Date
    doc.setFontSize(12);
    doc.text(`Generated: ${formatLADateTime(new Date())}`, 20, 35);
    
    // Table data
    const tableData = reports.map(report => {
      const client = clients.find(c => c.id === report.client_id);
      return [
        client?.name || 'Unknown',
        report.title,
        report.priority,
        report.status,
        formatLATime(report.created_at)
      ];
    });
    
    doc.autoTable({
      head: [['Client', 'Service', 'Priority', 'Status', 'Date']],
      body: tableData,
      startY: 50,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] }
    });
    
    doc.save('rog-pool-service-reports.pdf');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">
                🏊‍♂️ ROG Pool Service
              </h1>
              <span className="ml-4 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                v7.0
              </span>
            </div>
            <nav className="flex space-x-8">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'dashboard' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('clients')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'clients' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Clients
              </button>
              <button
                onClick={() => setCurrentView('reports')}
                className={`px-3 py-2 rounded-md text-sm font-medium ${
                  currentView === 'reports' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Reports
              </button>
              <button
                onClick={() => setCurrentView('new-client')}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                New Client
              </button>
              <button
                onClick={() => setCurrentView('new-report')}
                className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
              >
                New Report
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
            <button 
              onClick={() => setError(null)}
              className="float-right font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                        <span className="text-white font-bold">👥</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Clients
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {clients.length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                        <span className="text-white font-bold">📋</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Total Reports
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {reports.length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                        <span className="text-white font-bold">⚡</span>
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          Urgent Reports
                        </dt>
                        <dd className="text-lg font-medium text-gray-900">
                          {reports.filter(r => r.priority === 'URGENT').length}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Reports */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Recent Reports</h3>
                  <button
                    onClick={generatePDF}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
                  >
                    Export PDF
                  </button>
                </div>
                <div className="overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Service
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Priority
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reports.slice(0, 5).map((report) => {
                        const client = clients.find(c => c.id === report.client_id);
                        return (
                          <tr key={report.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {client?.name || 'Unknown'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {report.title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityStyle(report.priority)}`}>
                                {report.priority}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(report.status)}`}>
                                {report.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatLATime(report.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Clients View */}
        {currentView === 'clients' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Clients</h3>
              <div className="grid gap-4">
                {clients.map((client) => (
                  <div key={client.id} className="border rounded-lg p-4">
                    <h4 className="font-semibold text-lg">{client.name}</h4>
                    <p className="text-gray-600">{client.address}</p>
                    <div className="mt-2 flex space-x-4">
                      {client.phone && (
                        <span className="text-sm text-gray-500">📞 {client.phone}</span>
                      )}
                      {client.email && (
                        <span className="text-sm text-gray-500">✉️ {client.email}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Added: {formatLATime(client.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reports View */}
        {currentView === 'reports' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Service Reports</h3>
              <div className="space-y-4">
                {reports.map((report) => {
                  const client = clients.find(c => c.id === report.client_id);
                  return (
                    <div key={report.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg">{report.title}</h4>
                          <p className="text-gray-600">Client: {client?.name || 'Unknown'}</p>
                          <p className="text-gray-700 mt-2">{report.description}</p>
                          <div className="mt-3 flex space-x-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getPriorityStyle(report.priority)}`}>
                              {report.priority}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusStyle(report.status)}`}>
                              {report.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Created: {formatLADateTime(report.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingReport(report)}
                          className="ml-4 bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* New Client Form */}
        {currentView === 'new-client' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Client</h3>
              <form onSubmit={handleCreateClient} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    required
                    value={clientForm.name}
                    onChange={(e) => setClientForm({...clientForm, name: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <input
                    type="text"
                    required
                    value={clientForm.address}
                    onChange={(e) => setClientForm({...clientForm, address: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input
                    type="tel"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({...clientForm, phone: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({...clientForm, email: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Client'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* New Report Form */}
        {currentView === 'new-report' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Create Service Report</h3>
              <form onSubmit={handleCreateReport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client</label>
                  <select
                    required
                    value={reportForm.client_id}
                    onChange={(e) => setReportForm({...reportForm, client_id: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a client</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Service Title</label>
                  <input
                    type="text"
                    required
                    value={reportForm.title}
                    onChange={(e) => setReportForm({...reportForm, title: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    required
                    rows={4}
                    value={reportForm.description}
                    onChange={(e) => setReportForm({...reportForm, description: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={reportForm.priority}
                    onChange={(e) => setReportForm({...reportForm, priority: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="NEXT_WEEK">Next Week</option>
                    <option value="SAME_WEEK">Same Week</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Report'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Report Modal */}
        {editingReport && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Report</h3>
              <form onSubmit={handleUpdateReport} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={editingReport.status}
                    onChange={(e) => setEditingReport({...editingReport, status: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="reported">Reported</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={editingReport.priority}
                    onChange={(e) => setEditingReport({...editingReport, priority: e.target.value})}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="NEXT_WEEK">Next Week</option>
                    <option value="SAME_WEEK">Same Week</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingReport(null)}
                    className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;