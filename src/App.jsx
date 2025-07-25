import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Plus, Edit3, Trash2, ArrowLeft, Settings } from 'lucide-react';
import { supabase } from '../supabaseClient'; // Ensure you have set up Supabase client
import './App.css';


const TeleprompterApp = () => {
  const [documents, setDocuments] = useState([]); // Will be fetched from Supabase

  const [currentDoc, setCurrentDoc] = useState(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(100); // WPM
  const [showDocList, setShowDocList] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [isLoading, setIsLoading] = useState(true); // For loading documents
  const [mirror, setMirror] = useState(false); // For mirroring the text

  const intervalRef = useRef(null);
  const scrollRef = useRef(null);

  // Updated text processing to preserve line breaks
  const processText = (text) => {
    if (!text) return [];
    
    // Split by lines first, then process each line
    const lines = text.split(/\r?\n/);
    const elements = [];
    
    lines.forEach((line, lineIndex) => {
      if (line.trim()) {
        // Split line into words
        const words = line.split(/\s+/).filter(word => word.length > 0);
        words.forEach(word => {
          elements.push({ type: 'word', content: word });
        });
      }
      
      // Add line break after each line (except the last one)
      if (lineIndex < lines.length - 1) {
        elements.push({ type: 'linebreak' });
      }
    });
    
    return elements;
  };

  const textElements = currentDoc ? processText(currentDoc.content) : [];
  const words = textElements.filter(el => el.type === 'word');

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error.message);
        // You might want to set an error state here to show to the user
      } else {
        setDocuments(data || []);
      }
      setIsLoading(false);
    };

    fetchDocuments();
  }, []);

  useEffect(() => {
    if (isPlaying && currentDoc && currentWordIndex < words.length) {
      const interval = 60000 / speed; // Convert WPM to milliseconds
      intervalRef.current = setTimeout(() => {
        setCurrentWordIndex(prev => prev + 1);
      }, interval);
    } else if (currentWordIndex >= words.length) {
      setIsPlaying(false);
    }

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, [isPlaying, currentWordIndex, words.length, speed, currentDoc]);

  useEffect(() => {
    // Auto-scroll to keep current word visible
    if (scrollRef.current) {
      const currentWordElement = scrollRef.current.querySelector('.current-word');
      if (currentWordElement) {
        currentWordElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    }
  }, [currentWordIndex]);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const rewind = () => {
    setCurrentWordIndex(Math.max(0, currentWordIndex - 10));
  };

  const fastForward = () => {
    setCurrentWordIndex(Math.min(words.length - 1, currentWordIndex + 10));
  };

  const reset = () => {
    setCurrentWordIndex(0);
    setIsPlaying(false);
  };

  const createDocument = async () => {
    if (newDocTitle.trim() && newDocContent.trim()) {
      const { data, error } = await supabase
        .from('documents')
        .insert([{ title: newDocTitle, content: newDocContent }])
        .select();

      if (error) {
        console.error('Error creating document:', error.message);
        // Handle error (e.g., show a message to the user)
      } else if (data && data.length > 0) {
        setDocuments([data[0], ...documents]); // Add to the beginning of the list
        setNewDocTitle('');
        setNewDocContent('');
        setEditingDoc(null);
        setShowDocList(true); // Go back to document list
      }
    }
  };

  const updateDocument = async () => {
    if (editingDoc && newDocTitle.trim() && newDocContent.trim()) {
      const { data, error } = await supabase
        .from('documents')
        .update({ title: newDocTitle, content: newDocContent })
        .eq('id', editingDoc.id)
        .select();

      if (error) {
        console.error('Error updating document:', error.message);
        // Handle error
      } else if (data && data.length > 0) {
        const updatedDoc = data[0];
        setDocuments(documents.map(doc =>
          doc.id === updatedDoc.id ? updatedDoc : doc
        ));
        if (currentDoc && currentDoc.id === updatedDoc.id) {
          setCurrentDoc(updatedDoc);
          // Optionally reset progress: setCurrentWordIndex(0);
        }
        setNewDocTitle('');
        setNewDocContent('');
        setEditingDoc(null);
        setShowDocList(true); // Go back to document list
      }
    }
  };

  const deleteDocument = async (id) => {
    // Optional: Add a confirmation dialog here
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting document:', error.message);
      // Handle error
    } else {
      setDocuments(documents.filter(doc => doc.id !== id));
      if (currentDoc && currentDoc.id === id) {
        setCurrentDoc(null);
        setIsPlaying(false);
        setShowDocList(true); // Ensure doc list is shown if current doc is deleted
      }
    }
  };

  const startEditing = (doc) => {
    setEditingDoc(doc);
    setNewDocTitle(doc.title);
    setNewDocContent(doc.content);
    setShowDocList(false); // Hide doc list to show editor
  };

  const selectDocument = (doc) => {
    setCurrentDoc(doc);
    setCurrentWordIndex(0);
    setIsPlaying(false);
    setShowDocList(false);
  };

  const handleBackFromEditor = () => {
    setEditingDoc(null);
    setNewDocTitle('');
    setNewDocContent('');
    setShowDocList(true);
  };

  const handleAddNewDocument = () => {
    setShowDocList(false);
    setEditingDoc(null); // Ensure we are in "create" mode
    setNewDocTitle('');
    setNewDocContent('');
  };

  // Updated render function to handle line breaks
  const renderTextElements = () => {
    let wordIndex = 0;
    
    return textElements.map((element, index) => {
      if (element.type === 'linebreak') {
        return <br key={index} />;
      } else if (element.type === 'word') {
        const currentElement = (
          <span
            key={index}
            className={`teleprompter-word ${
              wordIndex === currentWordIndex
                ? 'current-word'
                : wordIndex < currentWordIndex
                ? 'past-word'
                : 'future-word'
            }`}
          >
            {element.content}
          </span>
        );
        wordIndex++;
        return currentElement;
      }
    });
  };

  if (isLoading && showDocList) { // Initial loading screen for document list
    return (
      <div className="loading-screen">
        <p className="loading-text">Loading documents...</p>
      </div>
    );
  }

  // Editor View (for new or existing documents)
  if (editingDoc || (!currentDoc && !showDocList && !isLoading)) {
    return (
      <div className="editor-view">
        <div className="editor-container">
          <div className="editor-header">
            <button onClick={handleBackFromEditor} className="back-button">
              <ArrowLeft size={20} />
              Back
            </button>
            <h1 className="editor-title">
              {editingDoc ? 'Edit Document' : 'New Document'}
            </h1>
          </div>

          <div className="editor-form">
            <div className="form-group">
              <label className="form-label">Title</label>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                className="form-input"
                placeholder="Enter document title..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Content</label>
              <textarea
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                rows={10}
                className="form-textarea"
                placeholder="Enter your speech or script content..."
              />
            </div>

            <div className="form-actions">
              <button
                onClick={editingDoc ? updateDocument : createDocument}
                disabled={!newDocTitle.trim() || !newDocContent.trim()}
                className="btn btn-primary"
              >
                {editingDoc ? 'Update' : 'Create'} Document
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Document List View
  if (showDocList) {
    return (
      <div className="document-list-view">
        <div className="document-list-container">
          <div className="document-list-header">
            <h1 className="page-title">My Documents</h1>
            <button onClick={handleAddNewDocument} className="add-button">
              <Plus size={20} />
              <span className="sr-only">Add New Document</span>
            </button>
          </div>

          <div className="document-list">
            {documents.map((doc) => (
              <div key={doc.id} className="document-card">
                <div className="document-content" onClick={() => selectDocument(doc)}>
                  <h3 className="document-title">{doc.title}</h3>
                  <p className="document-preview">
                    {doc.content.substring(0, 100)}{doc.content.length > 100 ? '...' : ''}
                  </p>
                </div>
                <div className="document-actions">
                  <button onClick={() => startEditing(doc)} className="action-button edit-button">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => deleteDocument(doc.id)} className="action-button delete-button">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!isLoading && documents.length === 0 && (
            <div className="empty-state">
              <p className="empty-message">No documents yet. Create your first one!</p>
              <button onClick={handleAddNewDocument} className="btn btn-primary">
                Create Your First Document
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Settings View
  if (showSettings) {
    return (
      <div className="settings-view">
        <div className="settings-container">
          <div className="settings-header">
            <button onClick={() => setShowSettings(false)} className="back-button">
              <ArrowLeft size={20} />
              Back
            </button>
            <h1 className="settings-title">Settings</h1>
            <div></div> {/* Spacer for alignment */}
          </div>

          <div className="settings-form">
            <div className="settings-group">
              <label className="settings-label">
                Reading Speed: {speed} WPM
              </label>
              <input
                type="range"
                min="50"
                max="300"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="speed-slider"
              />
              <div className="slider-labels">
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Teleprompter View
  // Fallback if currentDoc is somehow null when it shouldn't be
  if (!currentDoc) {
    // This state should ideally not be reached if logic is correct,
    // but as a safeguard, redirect to document list.
    setShowDocList(true);
    return (
      <div className="loading-screen">
        <p className="loading-text">No document selected. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="teleprompter-view">
      {/* Text Display */}
      <div ref={scrollRef} className="teleprompter-text-container">
        <div className={`teleprompter-text ${mirror ? 'mirrored' : ''}`}>
          {textElements.length > 0 ? renderTextElements() : <p className="empty-document">This document is empty.</p>}
        </div>
      </div>

      {/* Progress Bar */}
      {words.length > 0 && (
        <div className="progress-container">
          <div className="progress-info">
            <span>{Math.min(currentWordIndex + 1, words.length)}</span>
            <div className="progress-bar-container">
              <div
                className="progress-bar"
                style={{ width: `${words.length > 0 ? ((Math.min(currentWordIndex + 1, words.length)) / words.length) * 100 : 0}%` }}
              />
            </div>
            <span>{words.length}</span>
          </div>
        </div>
      )}

      {/* --- Floating UI Elements --- */}

      {/* Left Controls (Back/Settings) */}
      <div className="floating-controls-left">
        <div className="controls-inner">
          <button
            onClick={() => { setCurrentDoc(null); setIsPlaying(false); setShowDocList(true); }}
            className="control-button"
            aria-label="Back to Documents"
          >
            <ArrowLeft size={22} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="control-button"
            aria-label="Open Settings"
          >
            <Settings size={22} />
          </button>
           <button
            onClick={() => setMirror(!mirror)}
            className="control-button"
            aria-label="Toggle Mirror"
          >
            {mirror ? 'Mirror: On' : 'Mirror: Off'}
          </button>


        </div>
      </div>

      {/* Right Controls (Playback) */}
      <div className="floating-controls">
        <div className="controls-inner">
          <button
            onClick={reset}
            disabled={words.length === 0}
            className="control-button reset-button"
          >
            <RotateCcw size={20} />
          </button>

          <button
            onClick={rewind}
            disabled={words.length === 0}
            className="control-button rewind-button"
          >
            <FastForward size={20} className="rotate-180" />
          </button>

          <button
            onClick={togglePlayPause}
            disabled={words.length === 0}
            className="control-button play-button"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>

          <button
            onClick={fastForward}
            disabled={words.length === 0}
            className="control-button forward-button"
          >
            <FastForward size={20} />
          </button>

          <div className="speed-indicator">
            {speed} WPM
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeleprompterApp;