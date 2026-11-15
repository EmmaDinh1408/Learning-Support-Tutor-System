import { FileText, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { AppHeader } from '../features/layout/AppHeader';
import { useAsync } from '../features/common/useAsync';
import { useLanguage } from '../features/i18n/LanguageContext';
import type { CourseFile } from '../types';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_FILE = /\.(pdf|ppt|pptx|doc|docx|mp4|mov|zip)$/i;

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CourseFilesPage() {
  const { courseId = '' } = useParams();
  const { language } = useLanguage();
  const isVi = language === 'vi';
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, loading, error } = useAsync(() => api.getCourseFiles(courseId), [courseId]);
  const [files, setFiles] = useState<CourseFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (data) setFiles(data);
  }, [data]);

  const selectFile = (file?: File) => {
    setActionError('');
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!ALLOWED_FILE.test(file.name)) {
      setActionError(isVi ? 'Chỉ nhận PDF, Office, MP4/MOV hoặc ZIP.' : 'Accepted formats: PDF, Office, MP4/MOV, or ZIP.');
      setSelectedFile(null);
      return;
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      setActionError(isVi ? 'Tệp phải có dung lượng từ 1 byte đến 50 MB.' : 'File size must be between 1 byte and 50 MB.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    setActionError('');
    try {
      const uploaded = await api.uploadCourseFile(courseId, selectedFile);
      setFiles((current) => [uploaded, ...current]);
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : (isVi ? 'Không thể tải tệp lên.' : 'Upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page">
      <AppHeader />
      <main className="container course-files-page">
        <div className="assignments-heading">
          <div>
            <span className="profile-kicker">{courseId}</span>
            <h1>{isVi ? 'Tài liệu khóa học' : 'Course files'}</h1>
          </div>
          <span className="assignment-count"><FileText size={15} />{files.length}</span>
        </div>

        {error && <p className="form-error" role="alert">{error.message}</p>}
        {actionError && <p className="form-error" role="alert">{actionError}</p>}

        <form className="file-upload-card" onSubmit={upload}>
          <h2>{isVi ? 'Tải tài liệu mới lên' : 'Upload a course file'}</h2>
          <label className="file-dropzone" htmlFor="course-file-input">
            <Upload size={23} />
            <strong>{isVi ? 'Chọn tệp từ thiết bị' : 'Choose a file from your device'}</strong>
            <span>{isVi ? 'PDF, DOC/DOCX, PPT/PPTX, MP4/MOV, ZIP · tối đa 50 MB' : 'PDF, DOC/DOCX, PPT/PPTX, MP4/MOV, ZIP · up to 50 MB'}</span>
            <input
              ref={inputRef}
              id="course-file-input"
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.mov,.zip"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />
          </label>
          {selectedFile && (
            <div className="file-selected">
              <span><FileText size={15} />{selectedFile.name} · {formatBytes(selectedFile.size)}</span>
              <button type="button" className="icon-plain" aria-label={isVi ? 'Bỏ chọn tệp' : 'Remove selected file'} onClick={() => selectFile()}>
                <X size={15} />
              </button>
            </div>
          )}
          <div className="file-upload-actions">
            {import.meta.env.VITE_USE_MOCK_API !== 'false' && (
              <p className="muted">{isVi ? 'Chế độ mock chỉ lưu thông tin tệp; cần backend để lưu nội dung thật.' : 'Mock mode stores file metadata only; a backend is required to persist file contents.'}</p>
            )}
            <button type="submit" className="btn btn-primary" disabled={!selectedFile || uploading}>
              <Upload size={14} />{uploading ? (isVi ? 'Đang tải...' : 'Uploading...') : (isVi ? 'Tải lên' : 'Upload')}
            </button>
          </div>
        </form>

        <section className="course-file-list" aria-labelledby="course-file-list-heading">
          <div className="course-file-list-heading">
            <h2 id="course-file-list-heading">{isVi ? 'Tệp đã tải lên' : 'Uploaded files'}</h2>
            <span>{files.length}</span>
          </div>
          {loading && <p className="muted">{isVi ? 'Đang tải danh sách tệp...' : 'Loading files...'}</p>}
          {!loading && !error && !files.length && (
            <p className="course-empty-section">{isVi ? 'Khóa học chưa có tài liệu.' : 'No files have been added to this course.'}</p>
          )}
          {files.map((file) => (
            <article className="course-file-row" key={file.id}>
              <span className="course-file-icon"><FileText size={17} /></span>
              <div className="course-file-copy">
                <strong>{file.name}</strong>
                <span>{file.mimeType} · {formatBytes(file.sizeBytes)} · {new Date(file.uploadedAt).toLocaleDateString(isVi ? 'vi-VN' : 'en-US')}</span>
              </div>
              {file.downloadUrl && <a className="btn btn-outline sm" href={file.downloadUrl}>{isVi ? 'Tải xuống' : 'Download'}</a>}
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
