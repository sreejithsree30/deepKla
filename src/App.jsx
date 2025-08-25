import React, { useState, useEffect } from 'react';
import { 
  Upload, 
  FileText, 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Briefcase, 
  GraduationCap, 
  Code, 
  Star, 
  TrendingUp, 
  Eye, 
  X, 
  Calendar,
  MapPin,
  Award,
  Target,
  AlertCircle,
  CheckCircle,
  Loader
} from 'lucide-react';

const GEMINI_API_KEY = "Relpace Your Api Key";

const App = () => {
  const [activeTab, setActiveTab] = useState('analyze');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [selectedResume, setSelectedResume] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {

    const saved = localStorage.getItem('resumeAnalysisHistory');
    if (saved) {
      try {
        setAnalysisHistory(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading history:', e);
        setAnalysisHistory([]);
      }
    }
  }, []);

  const saveToHistory = (analysis) => {
    const newHistory = [...analysisHistory, analysis];
    setAnalysisHistory(newHistory);
    localStorage.setItem('resumeAnalysisHistory', JSON.stringify(newHistory));
  };

  const extractTextFromPDF = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result;
          const uint8Array = new Uint8Array(arrayBuffer);
          let text = '';
          
          for (let i = 0; i < uint8Array.length; i++) {
            const char = String.fromCharCode(uint8Array[i]);
            if (char.match(/[a-zA-Z0-9\s@.\-()]/)) {
              text += char;
            }
          }
          
        
          if (text.length < 50) {
           
            const decoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
            const decodedText = decoder.decode(uint8Array);
            const readableText = decodedText.match(/[a-zA-Z0-9\s@.\-(),;:!?'"]+/g);
            text = readableText ? readableText.join(' ') : '';
          }

          text = text
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s@.\-(),;:!?'"]/g, ' ')
            .trim();
          
          if (text.length < 20) {
            throw new Error('Could not extract readable text from PDF. Please ensure the PDF contains selectable text.');
          }
          
          resolve(text);
        } catch (error) {
          reject(new Error('Failed to extract text from PDF: ' + error.message));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read PDF file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  };


  const analyzeWithGemini = async (resumeText, fileName, retries = 3, delay = 5000) => {
  const prompt = `
    You are an expert resume analyzer for a modern Applicant Tracking System (ATS). Your task is to parse the following resume text and extract structured information with high accuracy. The output must be a valid JSON object that adheres strictly to the specified schema.

    Return ONLY a single JSON object. Do not include any additional text, markdown, or conversational elements.

    JSON Structure:
    {
      "personalDetails": {
        "name": "extracted name or 'Not specified'",
        "email": "extracted email or 'Not specified'",
        "phone": "extracted phone or 'Not specified'",
        "linkedin": "extracted linkedin url or 'Not specified'",
        "portfolio": "extracted portfolio/website url or 'Not specified'",
        "location": "extracted location/address or 'Not specified'"
      },
      "summary": "professional summary or objective (2-3 sentences)",
      "workExperience": [
        {
          "company": "company name",
          "position": "job title",
          "duration": "employment period",
          "description": "brief, achievement-oriented job description"
        }
      ],
      "education": [
        {
          "institution": "school/university name",
          "degree": "degree type and field",
          "duration": "study period",
          "gpa": "gpa if mentioned or 'Not specified'"
        }
      ],
      "projects": [
        {
          "name": "project name",
          "description": "project description",
          "technologies": ["tech1", "tech2"]
        }
      ],
      "certifications": ["certification1", "certification2"],
      "technicalSkills": ["skill1", "skill2", "skill3"],
      "softSkills": ["skill1", "skill2", "skill3"],
      "rating": 7,
      "improvementAreas": ["area1", "area2"],
      "suggestedSkills": ["skill1", "skill2"]
    }

    Analysis Instructions:
    1.  **Strict Adherence to Schema:** The JSON keys and structure must be an exact match. Do not introduce new keys or alter the structure.
    2.  **Accuracy:** Extract all information precisely. For 'Not specified' fields, use that exact string.
    3.  **Resume Quality Rating (1-10):** Evaluate the resume based on its clarity, completeness, and keyword relevance for the likely target roles. A higher rating indicates a resume that would be easily parsed and ranked highly by an ATS.
    4.  **Improvement Areas:** Provide specific, actionable feedback from an ATS perspective. Focus on formatting issues, keyword density, lack of quantifiable metrics, or missing essential sections.
    5.  **Suggested Skills:** Based on the candidate's experience and industry, recommend relevant, high-demand skills or technologies that would improve their keyword matching for future job applications.
    6.  **Work Experience Description:** The 'description' for each role should be concise and highlight achievements and results, using action verbs where present.
    7.  **Projects and Technologies:** Ensure that technologies are correctly identified and listed as separate strings in the 'technologies' array.

    Resume Text:
      ${resumeText}
    `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (response.status === 429 && retries > 0) {
      console.warn(`Rate limit hit, retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return analyzeWithGemini(resumeText, fileName, retries - 1, delay * 2); // exponential backoff
    }

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      throw new Error("Invalid response from Gemini API");
    }

  
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in API response");
    }

    const cleanedJson = jsonMatch[0].replace(/```json|```/g, "").trim();
    const parsedData = JSON.parse(cleanedJson);

    if (!parsedData.personalDetails || !parsedData.rating) {
      throw new Error("Invalid data structure from API");
    }

    return parsedData;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
};

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError(null);
    setCurrentAnalysis(null);
    setUploadProgress(0);

  
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file only.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setUploading(true);

    try {
      
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const resumeText = await extractTextFromPDF(file);
      
      setUploadProgress(100);
      clearInterval(progressInterval);
      setUploading(false);
      setAnalyzing(true);

      const analysis = await analyzeWithGemini(resumeText, file.name);
    
      const finalAnalysis = {
        ...analysis,
        fileName: file.name,
        fileSize: (file.size / 1024).toFixed(2) + ' KB',
        analyzedAt: new Date().toISOString(),
        id: Date.now(),
        extractedText: resumeText.substring(0, 500) + '...'
      };

      setCurrentAnalysis(finalAnalysis);
      saveToHistory(finalAnalysis);
      setAnalyzing(false);

    } catch (error) {
      console.error('Error processing file:', error);
      setError(error.message);
      setUploading(false);
      setAnalyzing(false);
      setUploadProgress(0);
    }

    event.target.value = '';
  };

  const openModal = (resume) => {
    setSelectedResume(resume);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedResume(null);
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all analysis history?')) {
      setAnalysisHistory([]);
      localStorage.removeItem('resumeAnalysisHistory');
    }
  };

  const AnalysisDisplay = ({ analysis }) => {
    if (!analysis) return null;

    return (
      <div className="space-y-8">
     
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Resume Analysis Complete</h2>
              <p className="text-blue-100 mb-2">Analysis for {analysis.fileName}</p>
              <p className="text-blue-200 text-sm">File size: {analysis.fileSize}</p>
            </div>
            <div className="text-center">
              <div className="text-6xl font-bold mb-2">{analysis.rating}/10</div>
              <div className="flex items-center justify-center mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-6 h-6 ${i < analysis.rating/2 ? 'text-yellow-300 fill-current' : 'text-gray-300'}`} 
                  />
                ))}
              </div>
              <p className="text-sm text-blue-200">
                {analysis.rating >= 8 ? 'Excellent' : 
                 analysis.rating >= 6 ? 'Good' : 
                 analysis.rating >= 4 ? 'Fair' : 'Needs Improvement'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
        
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <User className="mr-3 text-blue-500" />
              Personal Details
            </h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <User className="w-5 h-5 mr-3 text-gray-500" />
                <span className="font-medium">{analysis.personalDetails.name}</span>
              </div>
              <div className="flex items-center">
                <Mail className="w-5 h-5 mr-3 text-gray-500" />
                <span className="text-blue-600">{analysis.personalDetails.email}</span>
              </div>
              <div className="flex items-center">
                <Phone className="w-5 h-5 mr-3 text-gray-500" />
                <span>{analysis.personalDetails.phone}</span>
              </div>
              {analysis.personalDetails.linkedin !== 'Not specified' && (
                <div className="flex items-center">
                  <Globe className="w-5 h-5 mr-3 text-gray-500" />
                  <span className="text-blue-600 truncate">{analysis.personalDetails.linkedin}</span>
                </div>
              )}
              {analysis.personalDetails.location !== 'Not specified' && (
                <div className="flex items-center">
                  <MapPin className="w-5 h-5 mr-3 text-gray-500" />
                  <span>{analysis.personalDetails.location}</span>
                </div>
              )}
            </div>
          </div>

     
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Target className="mr-3 text-green-500" />
              Professional Summary
            </h3>
            <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
          </div>
        </div>


        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Code className="mr-3 text-purple-500" />
              Technical Skills ({analysis.technicalSkills.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.technicalSkills.map((skill, index) => (
                <span key={index} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium hover:bg-purple-200 transition-colors">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-orange-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Star className="mr-3 text-orange-500" />
              Soft Skills ({analysis.softSkills.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.softSkills.map((skill, index) => (
                <span key={index} className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium hover:bg-orange-200 transition-colors">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        {analysis.workExperience && analysis.workExperience.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Briefcase className="mr-3 text-indigo-500" />
              Work Experience ({analysis.workExperience.length})
            </h3>
            <div className="space-y-4">
              {analysis.workExperience.map((job, index) => (
                <div key={index} className="border-l-2 border-gray-200 pl-4 pb-4 hover:border-indigo-300 transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-lg text-gray-900">{job.position}</h4>
                    <span className="text-sm text-gray-500 flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      {job.duration}
                    </span>
                  </div>
                  <p className="text-indigo-600 font-medium mb-2">{job.company}</p>
                  <p className="text-gray-700">{job.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

       
        {analysis.education && analysis.education.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-teal-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <GraduationCap className="mr-3 text-teal-500" />
              Education ({analysis.education.length})
            </h3>
            <div className="space-y-4">
              {analysis.education.map((edu, index) => (
                <div key={index} className="border-l-2 border-gray-200 pl-4 hover:border-teal-300 transition-colors">
                  <h4 className="font-semibold text-lg text-gray-900">{edu.degree}</h4>
                  <p className="text-teal-600 font-medium">{edu.institution}</p>
                  <div className="flex justify-between text-sm text-gray-500 mt-1">
                    <span>{edu.duration}</span>
                    {edu.gpa && edu.gpa !== 'Not specified' && <span>GPA: {edu.gpa}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {analysis.projects && analysis.projects.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <FileText className="mr-3 text-red-500" />
              Projects ({analysis.projects.length})
            </h3>
            <div className="grid gap-4">
              {analysis.projects.map((project, index) => (
                <div key={index} className="border border-gray-200 p-4 rounded-lg hover:border-red-300 hover:shadow-md transition-all">
                  <h4 className="font-semibold text-lg mb-2 text-gray-900">{project.name}</h4>
                  <p className="text-gray-700 mb-3">{project.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {project.technologies.map((tech, techIndex) => (
                      <span key={techIndex} className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm hover:bg-gray-200 transition-colors">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}


        {analysis.certifications && analysis.certifications.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 flex items-center">
              <Award className="mr-3 text-yellow-500" />
              Certifications ({analysis.certifications.length})
            </h3>
            <div className="grid md:grid-cols-2 gap-2">
              {analysis.certifications.map((cert, index) => (
                <div key={index} className="flex items-center p-3 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors">
                  <Award className="w-5 h-5 mr-2 text-yellow-600" />
                  <span className="font-medium text-gray-900">{cert}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-red-50 p-6 rounded-xl shadow-lg border-l-4 border-red-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 text-red-700 flex items-center">
              <AlertCircle className="mr-3" />
              Areas for Improvement
            </h3>
            <ul className="space-y-2">
              {analysis.improvementAreas.map((area, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-red-500 mr-2 mt-1">•</span>
                  <span className="text-red-700">{area}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-green-50 p-6 rounded-xl shadow-lg border-l-4 border-green-500 hover:shadow-xl transition-shadow">
            <h3 className="text-2xl font-semibold mb-4 text-green-700 flex items-center">
              <TrendingUp className="mr-3" />
              Suggested Skills to Learn
            </h3>
            <div className="flex flex-wrap gap-2">
              {analysis.suggestedSkills.map((skill, index) => (
                <span key={index} className="bg-green-100 text-green-800 px-3 py-2 rounded-full text-sm font-medium hover:bg-green-200 transition-colors">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 inline mr-1" />
            Analysis completed on {new Date(analysis.analyzedAt).toLocaleString()}
          </p>
        </div>
      </div>
    );
  };

  const Modal = ({ isOpen, onClose, resume }) => {
    if (!isOpen || !resume) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-6xl max-h-[90vh] w-full overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center rounded-t-xl">
            <h2 className="text-2xl font-bold text-gray-900">Resume Analysis Details</h2>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-6">
            <AnalysisDisplay analysis={resume} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
      
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            AI Resume Analyzer
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload your resume and get AI-powered insights, feedback, and improvement suggestions using Google Gemini
          </p>
        </div>


        <div className="flex justify-center mb-8">
          <div className="bg-white p-1 rounded-xl shadow-lg">
            <button
              onClick={() => setActiveTab('analyze')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'analyze'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Live Analysis
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              History ({analysisHistory.length})
            </button>
          </div>
        </div>

        {activeTab === 'analyze' && (
          <div className="max-w-4xl mx-auto">
          
            {!currentAnalysis && (
              <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
                <div className="text-center">
                  <Upload className="w-16 h-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-4">Upload Your Resume</h3>
                  <p className="text-gray-600 mb-6">
                    Upload a PDF file to get instant AI-powered analysis using Google Gemini
                  </p>
                  
                
                  {GEMINI_API_KEY === 'AIzaSyBVZ8QXqXqXqXqXqXqXqXqXqXqXqXqXqXq' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                        <p className="text-yellow-800 text-sm">
                          Please replace the GEMINI_API_KEY in the code with your actual Google Gemini API key
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <label className="inline-block">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileUpload}
                      disabled={uploading || analyzing}
                      className="hidden"
                    />
                    <span className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold cursor-pointer transition-colors inline-flex items-center disabled:opacity-50">
                      <Upload className="w-5 h-5 mr-2" />
                      Choose PDF File
                    </span>
                  </label>
                  
                  <p className="text-sm text-gray-500 mt-4">
                    Maximum file size: 10MB • Supported format: PDF only
                  </p>
                </div>
              </div>
            )}

      
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                <div className="flex items-center">
                  <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-red-800">Error</h3>
                    <p className="text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

       
            {uploading && (
              <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
                <div className="mb-4">
                  <Loader className="animate-spin w-12 h-12 text-blue-500 mx-auto" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Processing PDF...</h3>
                <p className="text-gray-600 mb-4">Extracting text from your resume</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{uploadProgress}% complete</p>
              </div>
            )}

            {analyzing && (
              <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
                <div className="animate-pulse flex items-center justify-center mb-4">
                  <FileText className="w-12 h-12 text-purple-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Analyzing with AI...</h3>
                <p className="text-gray-600">Google Gemini is processing your resume content</p>
                <div className="flex justify-center mt-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                </div>
              </div>
            )}

    
            {currentAnalysis && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold">Analysis Results</h2>
                  <button
                    onClick={() => setCurrentAnalysis(null)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Analyze Another
                  </button>
                </div>
                <AnalysisDisplay analysis={currentAnalysis} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-bold text-center">Analysis History</h2>
              {analysisHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  Clear History
                </button>
              )}
            </div>
            
            {analysisHistory.length === 0 ? (
              <div className="bg-white p-12 rounded-2xl shadow-lg text-center">
                <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-2xl font-semibold mb-2 text-gray-600">No Analysis History</h3>
                <p className="text-gray-500 mb-6">Upload and analyze your first resume to see it here</p>
                <button
                  onClick={() => setActiveTab('analyze')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Start Analyzing
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Name</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Email</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">File Name</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Rating</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Date</th>
                        <th className="px-6 py-4 text-left font-semibold text-gray-900">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {analysisHistory.map((resume) => (
                        <tr key={resume.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">
                              {resume.personalDetails.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {resume.personalDetails.email}
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            <div className="truncate max-w-xs" title={resume.fileName}>
                              {resume.fileName}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <span className="font-semibold mr-2">{resume.rating}/10</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star 
                                    key={i} 
                                    className={`w-4 h-4 ${i < resume.rating/2 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                                  />
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-600">
                            {new Date(resume.analyzedAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => openModal(resume)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold inline-flex items-center transition-colors"
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={closeModal} resume={selectedResume} />
    </div>
  );
};

export default App;
