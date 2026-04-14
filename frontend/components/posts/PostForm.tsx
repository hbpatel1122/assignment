import React, { useState } from 'react';

interface PostFormProps {
  initialCaption?: string;
  initialImageUrl?: string;
  onSubmit: (data: { caption: string; file: File | null }) => void;
  onCancel: () => void;
  loading?: boolean;
  mode?: 'add' | 'edit';
}

const PostForm: React.FC<PostFormProps> = ({
  initialCaption = '',
  initialImageUrl = '',
  onSubmit,
  onCancel,
  loading = false,
  mode = 'add',
}) => {
  const [caption, setCaption] = useState(initialCaption);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>(initialImageUrl);
  const [fileType, setFileType] = useState<'image' | 'video' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const MAX_SIZE_MB = 20;
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const f = e.target.files?.[0] || null;
    if (f) {
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`File size must be less than ${MAX_SIZE_MB}MB.`);
        setFile(null);
        setPreview('');
        setFileType(null);
        return;
      }
      setFile(f);
      setPreview(URL.createObjectURL(f));
      if (f.type.startsWith('image/')) setFileType('image');
      else if (f.type.startsWith('video/')) setFileType('video');
      else {
        setError('Only image or video files are allowed.');
        setFile(null);
        setPreview('');
        setFileType(null);
      }
    } else {
      setFile(null);
      setPreview(initialImageUrl);
      setFileType(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file && !['image', 'video'].includes(fileType!)) {
      setError('Only image or video files are allowed.');
      return;
    }
    onSubmit({ caption, file });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Caption</label>
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={160}
          rows={3}
          placeholder="What's on your mind?"
          className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition"
        />
        <p className="text-gray-600 text-xs text-right mt-1">{caption.length}/160</p>
      </div>
      <div>
        <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Image/Video</label>
        <input
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {error && <div className="text-red-400 text-xs mt-1">{error}</div>}
        {preview && fileType === 'image' && (
          <img src={preview} alt="Preview" className="mt-2 rounded-xl max-h-48 border border-gray-700" />
        )}
        {preview && fileType === 'video' && (
          <video src={preview} controls className="mt-2 rounded-xl max-h-48 border border-gray-700" />
        )}
      </div>
      <div className="flex gap-2 justify-end mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
          disabled={loading}
        >
          {mode === 'edit' ? 'Update Post' : 'Add Post'}
        </button>
      </div>
    </form>
  );
};

export default PostForm;
