import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FileUploadZone from '../components/FileUploadZone'
import StatusBadge from '../components/StatusBadge'
import ConfirmModal from '../components/ConfirmModal'
import LoadingSpinner from '../components/LoadingSpinner'

export default function Documents() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [docType, setDocType] = useState('lab_report')
  const [deleteTarget, setDeleteTarget] = useState(null)

  const fetchDocs = useCallback(async () => {
    try {
      const res = await api.get('/documents/list')
      setDocuments(res.data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDocs() }, [fetchDocs])

  // Poll for pending/processing docs
  useEffect(() => {
    const pending = documents.filter(d => d.ocr_status === 'pending' || d.ocr_status === 'processing')
    if (pending.length === 0) return
    const interval = setInterval(async () => {
      for (const doc of pending) {
        try {
          const res = await api.get(`/documents/${doc.id}/status`)
          if (res.data.ocr_status !== doc.ocr_status) fetchDocs()
        } catch {}
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [documents, fetchDocs])

  const handleUpload = async (file) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', docType)
    try {
      await api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      await fetchDocs()
    } catch (err) {
      alert(err.response?.data?.error || 'Upload failed')
    } finally { setUploading(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(`/documents/${deleteTarget}`)
      await fetchDocs()
    } catch {} finally { setDeleteTarget(null) }
  }

  const handlePreview = async (id) => {
    try {
      const res = await api.get(`/documents/${id}/preview`)
      window.open(res.data.preview_url, '_blank')
    } catch { alert('Could not generate preview.') }
  }

  if (loading) return <><Navbar /><main style={{ paddingTop: '76px' }}><LoadingSpinner /></main></>

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '76px' }}>
        <div className="container py-4 page-content">
          <div className="mb-4"><h3 className="fw-bold"><i className="fas fa-file-medical text-primary-green me-2"></i>Medical Documents</h3>
            <p className="text-muted">Upload and manage your medical documents for AI analysis</p></div>

          <div className="content-card mb-4">
            <div className="card-header-custom"><h5><i className="fas fa-cloud-upload-alt text-primary-green me-2"></i>Upload New Document</h5></div>
            <div className="mb-3">
              <label htmlFor="doc-type-select" className="form-label-nutriai">Document Type</label>
              <select id="doc-type-select" className="form-control form-control-nutriai" style={{ maxWidth: '300px' }} value={docType} onChange={e => setDocType(e.target.value)}>
                <option value="lab_report">Lab Report</option><option value="prescription">Prescription</option><option value="other">Other</option>
              </select>
            </div>
            <FileUploadZone onFileSelect={handleUpload} uploading={uploading} progress={0} />
          </div>

          <div className="content-card">
            <div className="card-header-custom"><h5><i className="fas fa-folder-open text-primary-green me-2"></i>Your Documents ({documents.length})</h5></div>
            {documents.length > 0 ? (
              <div className="table-responsive">
                <table className="table table-nutriai mb-0">
                  <thead><tr><th>Name</th><th>Type</th><th>Uploaded</th><th>OCR Status</th><th>Actions</th></tr></thead>
                  <tbody>{documents.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <i className="fas fa-file-alt text-primary-green me-2"></i>
                        {doc.original_filename.slice(0, 40)}{doc.original_filename.length > 40 ? '...' : ''}
                        {doc.ocr_status === 'failed' && doc.ocr_content && (
                          <div className="text-danger small mt-1">
                            <i className="fas fa-exclamation-circle me-1"></i>{doc.ocr_content}
                          </div>
                        )}
                      </td>
                      <td>{doc.document_type.replaceAll('_', ' ').replaceAll(/\b\w/g, l => l.toUpperCase())}</td>
                      <td>{new Date(doc.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td><StatusBadge status={doc.ocr_status} /></td>
                      <td>
                        <button className="btn btn-sm btn-nutriai-outline me-1" onClick={() => handlePreview(doc.id)} title="Preview"><i className="fas fa-eye"></i></button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleteTarget(doc.id)} title="Delete"><i className="fas fa-trash"></i></button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-5"><i className="fas fa-folder-open text-muted mb-3" style={{ fontSize: '3rem' }}></i><p className="text-muted">No documents uploaded yet. Upload your first document above!</p></div>
            )}
          </div>
        </div>
      </main>
      <Footer />
      <ConfirmModal show={!!deleteTarget} title="Delete Document" message="Are you sure you want to delete this document? This action cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </>
  )
}
