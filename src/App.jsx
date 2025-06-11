import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Plus, Edit3, Trash2, ArrowLeft, Settings } from 'lucide-react';
import { supabase } from '../supabaseClient'; // Ensure you have set up Supabase client 
import './App.css';


const TeleprompterApp = () => {
  const [documents, setDocuments] = useState([]); // Will be fetched from Supabase
  
  const [currentDoc, setCurrentDoc] = useState(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200); // WPM
  const [showDocList, setShowDocList] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [isLoading, setIsLoading] = useState(true); // For loading documents
  
  const intervalRef = useRef(null);
  const scrollRef = useRef(null);

  const words = currentDoc ? currentDoc.content.split(/\s+/).filter(word => word.length > 0) : [];

  console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY);
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
          block: 'center' 
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

  const renderWords = () => {
    return words.map((word, index) => (
      <span
        key={index}
        className={`inline-block mx-1 my-1 px-2 py-1 rounded transition-all duration-200 ${
          index === currentWordIndex
            ? 'current-word bg-blue-500 text-white shadow-lg scale-110'
            : index < currentWordIndex
            ? 'bg-gray-200 text-gray-600'
            : 'text-gray-800'
        }`}
      >
        {word}
      </span>
    ));
  };

  if (isLoading && showDocList) { // Initial loading screen for document list
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl text-gray-700">Loading documents...</p>
      </div>
    );
  }

  // Editor View (for new or existing documents)
  if (editingDoc || (!currentDoc && !showDocList && !isLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleBackFromEditor}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft size={20} />
              Back
            </button>
            <h1 className="text-xl font-bold text-gray-800">
              {editingDoc ? 'Edit Document' : 'New Document'}
            </h1>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter document title..."
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Content
              </label>
              <textarea
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                rows={10}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your speech or script content..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={editingDoc ? updateDocument : createDocument}
                disabled={!newDocTitle.trim() || !newDocContent.trim()}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">My Documents</h1>
            <button
              onClick={handleAddNewDocument}
              className="bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors"
            >
              <Plus size={20} />
              <span className="sr-only">Add New Document</span>
            </button>
          </div>

          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="bg-white rounded-lg shadow-md p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => selectDocument(doc)}>
                    <h3 className="font-semibold text-gray-800">{doc.title}</h3>
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {doc.content.substring(0, 100)}{doc.content.length > 100 ? '...' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => startEditing(doc)}
                      className="p-2 text-gray-500 hover:text-blue-500 transition-colors"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      className="p-2 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isLoading && documents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No documents yet. Create your first one!</p>
              <button
                onClick={handleAddNewDocument}
                className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600 transition-colors"
              >
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
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowSettings(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft size={20} />
              Back
            </button>
            <h1 className="text-xl font-bold text-gray-800">Settings</h1>
            <div></div> {/* Spacer for alignment */}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reading Speed: {speed} WPM
              </label>
              <input
                type="range"
                min="50"
                max="300"
                value={speed}
                onChange={(e) => setSpeed(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xl text-gray-700">No document selected. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 text-white p-4 flex items-center justify-between">
        <button
          onClick={() => { setCurrentDoc(null); setIsPlaying(false); setShowDocList(true);}}
          className="flex items-center gap-2 text-gray-300 hover:text-white"
        >
          <ArrowLeft size={20} />
          Documents
        </button>
        <h1 className="font-semibold truncate mx-4 flex-1 text-center">{currentDoc?.title || "Untitled Document"}</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-300 hover:text-white"
        >
          <Settings size={20} />
        </button>
      </div>

      {/* Text Display */}
      <div 
        ref={scrollRef}
        className="flex-1 p-6 overflow-y-auto"
        style={{ fontSize: '18px', lineHeight: '1.6' }}
      >
        <div className="max-w-4xl mx-auto">
          {words.length > 0 ? renderWords() : <p className="text-gray-500 text-center py-10">This document is empty.</p>}
        </div>
      </div>

      {/* Progress Bar */}
      {words.length > 0 && (
        <div className="px-4 py-2 bg-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>{Math.min(currentWordIndex + 1, words.length)}</span>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-200"
                style={{ width: `${words.length > 0 ? ((Math.min(currentWordIndex + 1, words.length)) / words.length) * 100 : 0}%` }}
              />
            </div>
            <span>{words.length}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-800 p-4">
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            disabled={words.length === 0}
            className="bg-gray-600 text-white p-3 rounded-full hover:bg-gray-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <RotateCcw size={20} />
          </button>
          
          <button
            onClick={rewind}
            disabled={words.length === 0}
            className="bg-gray-600 text-white p-3 rounded-full hover:bg-gray-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <FastForward size={20} className="rotate-180" />
          </button>
          
          <button
            onClick={togglePlayPause}
            disabled={words.length === 0}
            className="bg-blue-500 text-white p-4 rounded-full hover:bg-blue-400 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          <button
            onClick={fastForward}
            disabled={words.length === 0}
            className="bg-gray-600 text-white p-3 rounded-full hover:bg-gray-500 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <FastForward size={20} />
          </button>
          
          <div className="text-white text-sm">
            {speed} WPM
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeleprompterApp;