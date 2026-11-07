import React, { useState, useEffect, useRef } from 'react';
import Card from '../../../components/base/Card';
import Button from '../../../components/base/Button';
import Badge from '../../../components/base/Badge';
import SearchableDropdown from '../../../components/base/SearchableDropdown';
import { financialsService } from '../../../services/financialsService';
import { FMS_BANK_WIRE_DETAILS } from '../../../constants/bankWireDetails';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const IPInvoiceManager: React.FC = () => {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  // Wire details modal state
  const [showWireModal, setShowWireModal] = useState(false);
  const [selectedInvoiceForWire, setSelectedInvoiceForWire] = useState<any>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    journey_id: '',
    intended_parent_id: '',
    invoice_number: `INV-${Date.now()}`,
    agency_fee: 0,
    trust_account_allocation: 0,
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0], // +15 days
  });

  const invoiceRef = useRef<HTMLDivElement>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);

  useEffect(() => {
    loadInvoices();
    loadLookups();
  }, []);

  const loadLookups = async () => {
    try {
      const jData = await financialsService.getJourneys();
      const uData = await financialsService.getUsers();
      setJourneys(jData || []);
      setUsers(uData || []);
    } catch (e) {
      console.error('Error loading lookups:', e);
    }
  };

  const loadInvoices = async () => {
    try {
      const data = await financialsService.getIpInvoices();
      setInvoices(data || []);
    } catch (e) {
      console.error('Error loading invoices:', e);
    } finally {
      setLoading(false);
    }
  };

  const getIPDisplayName = (user: any) => {
    if (!user) return '—';
    const p1 = user.parent1?.name || (typeof user.parent1 === 'string' ? user.parent1 : null);
    if (p1 && p1.trim()) return p1.trim();
    const first = user.first_name || user.firstName || user.formData?.firstName || '';
    const last = user.last_name || user.lastName || user.formData?.lastName || '';
    const combined = [first, last].filter(Boolean).join(' ');
    return combined || user.email || '—';
  };

  const handleMarkPaid = async (id: string) => {
    try {
      if (window.confirm('Mark this invoice as PAID? This will automatically top up the associated Trust Account.')) {
        await financialsService.markInvoicePaid(id);
        loadInvoices();
      }
    } catch (e) {
      console.error(e);
      alert('Error marking invoice as paid.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAmount = Number(formData.agency_fee) + Number(formData.trust_account_allocation);
      await financialsService.createIpInvoice({
        ...formData,
        total_amount: totalAmount,
      });
      setShowModal(false);
      loadInvoices();
      setFormData({
        journey_id: '',
        intended_parent_id: '',
        invoice_number: `INV-${Date.now()}`,
        agency_fee: 0,
        trust_account_allocation: 0,
        due_date: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      });
    } catch (e) {
      console.error(e);
      alert('Error creating invoice. Check console.');
    }
  };

  const generatePDF = async (invoice: any) => {
    setPreviewInvoice(invoice);
    // Wait for state to update and render
    setTimeout(async () => {
      if (invoiceRef.current) {
        const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`${invoice.invoice_number}.pdf`);
        setPreviewInvoice(null);
      }
    }, 500);
  };

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllWireDetails = () => {
    const ref = selectedInvoiceForWire ? `Invoice #${selectedInvoiceForWire.invoice_number}` : 'Invoice';
    const text = `BANK WIRE INSTRUCTIONS
Bank Name: ${FMS_BANK_WIRE_DETAILS.bankName}
Account Name: ${FMS_BANK_WIRE_DETAILS.beneficiaryName}
Account Number: ${FMS_BANK_WIRE_DETAILS.accountNumber}
Routing Number: ${FMS_BANK_WIRE_DETAILS.routingNumber}
SWIFT CODE: ${FMS_BANK_WIRE_DETAILS.swiftCode}
Reference: ${ref}

Address: ${FMS_BANK_WIRE_DETAILS.address}
Phone: ${FMS_BANK_WIRE_DETAILS.phone}
Website: ${FMS_BANK_WIRE_DETAILS.website}`;

    navigator.clipboard.writeText(text);
    setCopiedField('all');
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Intended Parent Invoices</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => {
              setSelectedInvoiceForWire(null);
              setShowWireModal(true);
            }}
          >
            <i className="ri-bank-line mr-1.5 text-blue-600"></i> Wire Instructions
          </Button>
          <Button color="blue" onClick={() => setShowModal(true)}>
            <i className="ri-add-line mr-1.5"></i> Create Invoice
          </Button>
        </div>
      </div>

      {/* Real Bank Wire Details Banner */}
      <div className="mb-6 bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <i className="ri-bank-line text-lg"></i>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-sm">Bank Wire Instructions</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                {FMS_BANK_WIRE_DETAILS.bankName} • {FMS_BANK_WIRE_DETAILS.beneficiaryName} • Account: <strong className="font-mono">{FMS_BANK_WIRE_DETAILS.accountNumber}</strong> • Routing: <strong className="font-mono">{FMS_BANK_WIRE_DETAILS.routingNumber}</strong> • SWIFT: <strong className="font-mono">{FMS_BANK_WIRE_DETAILS.swiftCode}</strong>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedInvoiceForWire(null);
              setShowWireModal(true);
            }}
            className="bg-white dark:bg-slate-800 text-xs shrink-0"
          >
            <i className="ri-file-copy-line mr-1 text-blue-600"></i> Wire Details
          </Button>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg w-full max-w-lg shadow-xl">
            <h3 className="text-lg font-bold mb-4">Create IP Invoice</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Invoice Number</label>
                  <input type="text" required className="w-full border rounded p-2 text-black bg-gray-100" 
                    value={formData.invoice_number} readOnly />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Due Date</label>
                  <input type="date" required className="w-full border rounded p-2 text-black" 
                    value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Journey</label>
                <SearchableDropdown
                  options={journeys.map(j => ({ id: j.id, name: j.case_number || `Journey ${j.id.substring(0, 8)}` }))}
                  value={formData.journey_id}
                  onChange={val => {
                    const selectedJourney = journeys.find(j => j.id === val);
                    setFormData({ 
                      ...formData, 
                      journey_id: val,
                      intended_parent_id: selectedJourney?.intended_parent_id || selectedJourney?.parent_id || ''
                    });
                  }}
                  placeholder="Select Journey"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Intended Parent</label>
                <SearchableDropdown
                  options={users
                    .filter(u => {
                      if (formData.journey_id) {
                        const j = journeys.find(jx => jx.id === formData.journey_id);
                        return u.id === (j?.intended_parent_id || j?.parent_id);
                      }
                      const r = (u.role || '').toLowerCase().replace(/[\s_-]/g, '');
                      return r === 'intendedparent';
                    })
                    .map(u => ({ id: u.id, name: getIPDisplayName(u) }))}
                  value={formData.intended_parent_id}
                  onChange={val => setFormData({ ...formData, intended_parent_id: val })}
                  placeholder="Select IP"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Agency Fee ($)</label>
                  <input type="number" required min="0" step="any" className="w-full border rounded p-2 text-black" 
                    value={formData.agency_fee || ''} onChange={e => setFormData({...formData, agency_fee: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Trust Account Top-up ($)</label>
                  <input type="number" required min="0" step="any" className="w-full border rounded p-2 text-black" 
                    value={formData.trust_account_allocation || ''} onChange={e => setFormData({...formData, trust_account_allocation: Number(e.target.value)})} />
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-950/40 p-4 rounded mt-4 border border-blue-100 dark:border-blue-900/40">
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200 text-right">
                  Total Invoice Amount: ${(Number(formData.agency_fee) + Number(formData.trust_account_allocation)).toLocaleString()}
                </p>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" type="button" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button color="blue" type="submit">Create Invoice</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wire Details Modal */}
      {showWireModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-full max-w-xl shadow-2xl border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between border-b dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xl">
                  <i className="ri-bank-line"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Bank Wire Instructions</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Payment details for wire transfers to Family Matters Surrogacy</p>
                </div>
              </div>
              <button 
                onClick={() => setShowWireModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            {selectedInvoiceForWire && (
              <div className="mb-4 p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">Invoice Reference</p>
                  <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{selectedInvoiceForWire.invoice_number}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Billed to: {getIPDisplayName(selectedInvoiceForWire.users || users.find(u => u.id === selectedInvoiceForWire.intended_parent_id))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Due</p>
                  <p className="text-lg font-extrabold text-rose-600">${Number(selectedInvoiceForWire.total_amount).toLocaleString()}</p>
                </div>
              </div>
            )}

            <div className="space-y-3 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-100 dark:border-slate-800 text-sm">
              <div className="flex items-center justify-between py-1 border-b dark:border-slate-700/60">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Bank Name:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{FMS_BANK_WIRE_DETAILS.bankName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b dark:border-slate-700/60">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Beneficiary / Account Name:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{FMS_BANK_WIRE_DETAILS.beneficiaryName}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b dark:border-slate-700/60">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Account Number:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{FMS_BANK_WIRE_DETAILS.accountNumber}</span>
                  <button
                    onClick={() => handleCopy(FMS_BANK_WIRE_DETAILS.accountNumber, 'accountNumber')}
                    className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
                  >
                    {copiedField === 'accountNumber' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-1 border-b dark:border-slate-700/60">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Routing Number:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{FMS_BANK_WIRE_DETAILS.routingNumber}</span>
                  <button
                    onClick={() => handleCopy(FMS_BANK_WIRE_DETAILS.routingNumber, 'routingNumber')}
                    className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
                  >
                    {copiedField === 'routingNumber' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-1 border-b dark:border-slate-700/60">
                <span className="text-gray-500 dark:text-gray-400 text-xs">SWIFT CODE:</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{FMS_BANK_WIRE_DETAILS.swiftCode}</span>
                  <button
                    onClick={() => handleCopy(FMS_BANK_WIRE_DETAILS.swiftCode, 'swiftCode')}
                    className="text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 hover:bg-blue-200"
                  >
                    {copiedField === 'swiftCode' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between py-1 border-b dark:border-slate-700/60">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Agency Phone:</span>
                <span className="font-medium text-gray-900 dark:text-white">{FMS_BANK_WIRE_DETAILS.phone}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500 dark:text-gray-400 text-xs">Agency Address:</span>
                <span className="font-medium text-right text-gray-900 dark:text-white text-xs">{FMS_BANK_WIRE_DETAILS.address}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyAllWireDetails}
                className="text-xs"
              >
                <i className="ri-file-copy-line mr-1 text-blue-600"></i>
                {copiedField === 'all' ? 'Copied Full Details!' : 'Copy All Wire Details'}
              </Button>

              <div className="flex items-center gap-2">
                {selectedInvoiceForWire && (
                  <Button
                    size="sm"
                    color="blue"
                    onClick={() => generatePDF(selectedInvoiceForWire)}
                  >
                    <i className="ri-download-2-line mr-1"></i> Download PDF
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowWireModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Invoice Template for PDF Generation */}
      {previewInvoice && (
        <div className="fixed top-[-9999px] left-[-9999px]">
          <div ref={invoiceRef} className="bg-white p-10 w-[800px] text-black border shadow-lg font-sans">
            <div className="flex justify-between items-center mb-8 border-b pb-6">
              <div>
                <h1 className="text-4xl font-black text-rose-500">INVOICE</h1>
                <p className="text-gray-500 mt-2">Family Matters Agency</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{previewInvoice.invoice_number}</p>
                <p className="text-gray-500">Due: {new Date(previewInvoice.due_date).toLocaleDateString()}</p>
              </div>
            </div>
            
            <div className="mb-8">
              <p className="text-gray-500 text-sm font-bold uppercase mb-2">Billed To:</p>
              <p className="font-bold text-lg">
                {getIPDisplayName(previewInvoice.users || users.find(u => u.id === previewInvoice.intended_parent_id))}
              </p>
              {previewInvoice.journey_id && (
                <p className="text-gray-600 text-sm">Journey ID: {previewInvoice.journey_id.substring(0, 8)}</p>
              )}
            </div>

            <table className="w-full mb-8 border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-800">
                  <th className="py-3 px-4 text-left font-bold">Description</th>
                  <th className="py-3 px-4 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Number(previewInvoice.agency_fee) > 0 && (
                  <tr className="border-b">
                    <td className="py-3.5 px-4">Agency Administration Fee</td>
                    <td className="py-3.5 px-4 text-right">${Number(previewInvoice.agency_fee).toLocaleString()}</td>
                  </tr>
                )}
                {Number(previewInvoice.trust_account_allocation) > 0 && (
                  <tr className="border-b">
                    <td className="py-3.5 px-4">Trust Account Top-up Allocation</td>
                    <td className="py-3.5 px-4 text-right">${Number(previewInvoice.trust_account_allocation).toLocaleString()}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-end mb-8">
              <div className="w-1/2">
                <div className="flex justify-between py-2 font-bold text-xl border-t-2 border-gray-800">
                  <span>TOTAL DUE:</span>
                  <span className="text-rose-500">${Number(previewInvoice.total_amount).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            {/* Real Bank Wire Instructions as given in FMS Bank Wire Instructions.pdf */}
            <div className="mt-8 p-6 border-2 border-gray-200 rounded-lg bg-gray-50">
              <h3 className="font-bold text-sm uppercase tracking-wide text-gray-900 mb-3 border-b pb-2">
                Bank Wire Instructions
              </h3>
              <div className="space-y-1.5 text-sm text-gray-800">
                <p className="font-semibold text-base">{FMS_BANK_WIRE_DETAILS.bankName}</p>
                <p className="font-medium text-gray-700">{FMS_BANK_WIRE_DETAILS.beneficiaryName}</p>
                <p>
                  <span className="text-gray-500">Account Number:</span>{' '}
                  <span className="font-mono font-bold text-gray-900">{FMS_BANK_WIRE_DETAILS.accountNumber}</span>
                </p>
                <p>
                  <span className="text-gray-500">Routing Number:</span>{' '}
                  <span className="font-mono font-bold text-gray-900">{FMS_BANK_WIRE_DETAILS.routingNumber}</span>
                </p>
                <p>
                  <span className="text-gray-500">SWIFT CODE:</span>{' '}
                  <span className="font-mono font-bold text-gray-900">{FMS_BANK_WIRE_DETAILS.swiftCode}</span>
                </p>
                <p className="text-xs text-gray-500 italic mt-2">
                  Please reference Invoice #{previewInvoice.invoice_number} in your wire transfer.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t text-xs text-gray-500 flex justify-between items-center">
                <span>{FMS_BANK_WIRE_DETAILS.address}</span>
                <span>{FMS_BANK_WIRE_DETAILS.phone} • {FMS_BANK_WIRE_DETAILS.website}</span>
              </div>
            </div>

            <div className="mt-12 text-center text-gray-400 text-sm border-t pt-4">
              Thank you for choosing Family Matters Agency.
            </div>
          </div>
        </div>
      )}

      {invoices.length === 0 ? (
        <p className="text-gray-500">No invoices generated yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b dark:border-white/10">
                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Invoice #</th>
                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">IP Name</th>
                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Due Date</th>
                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Total</th>
                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="py-3 px-4 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const ipUser = inv.users || users.find(u => u.id === inv.intended_parent_id);
                const ipName = getIPDisplayName(ipUser);

                return (
                  <tr key={inv.id} className="border-b hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium">{inv.invoice_number}</td>
                    <td className="py-3 px-4 font-medium">{ipName}</td>
                    <td className="py-3 px-4">{new Date(inv.due_date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      ${Number(inv.total_amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge color={inv.status === 'PAID' ? 'green' : 'yellow'}>{inv.status}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => generatePDF(inv)} title="Download Invoice PDF">
                          <i className="ri-download-2-line mr-1"></i> PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInvoiceForWire(inv);
                            setShowWireModal(true);
                          }}
                          title="View Wire Instructions"
                        >
                          <i className="ri-bank-line mr-1 text-blue-500"></i> Wire Info
                        </Button>
                        {inv.status === 'PENDING' && (
                          <Button color="green" size="sm" onClick={() => handleMarkPaid(inv.id)}>
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};
