import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RESOURCE_SOURCES } from "@/components/school/data/resourceSources";
import { BookOpen, Search, ExternalLink, Bookmark, CheckCircle, FileText, Download, MonitorPlay } from "lucide-react";

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<"sources" | "notes" | "aids">("sources");
  const [searchQuery, setSearchQuery] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("All");

  const filteredSources = useMemo(() => {
    return RESOURCE_SOURCES.filter(src => {
      const matchesCoverage = coverageFilter === "All" || src.coverage.includes(coverageFilter);
      const matchesSearch = !searchQuery || 
        src.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        src.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCoverage && matchesSearch;
    });
  }, [coverageFilter, searchQuery]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 uppercase">Curriculum Resources</h1>
        <p className="text-sm text-slate-500 mt-1">Access external resources, lesson note templates, and teaching aids</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("sources")}
          className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "sources" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          External Sources
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "notes" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          Lesson Note Templates
        </button>
        <button
          onClick={() => setActiveTab("aids")}
          className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
            activeTab === "aids" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          Teaching Aids
        </button>
      </div>

      {activeTab === "sources" && (
        <Card className="p-0 overflow-hidden border-2 border-slate-100">
          <div className="bg-slate-50 p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input 
                placeholder="Search resources..." 
                className="pl-9 h-10 border-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0 hide-scrollbar">
              {["All", "Nursery", "Primary", "Secondary"].map(filter => (
                <button
                  key={filter}
                  onClick={() => setCoverageFilter(filter)}
                  className={`px-3 py-1.5 whitespace-nowrap rounded-full text-xs font-bold transition-all ${
                    coverageFilter === filter
                      ? "bg-indigo-600 text-white"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSources.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500">
                <BookOpen size={40} className="mx-auto text-slate-300 mb-3" />
                <p>No resources match your filters.</p>
              </div>
            ) : (
              filteredSources.map((src) => (
                <div key={src.id} className="group p-4 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md transition-all flex flex-col h-full">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl bg-slate-50 w-12 h-12 flex items-center justify-center rounded-lg border border-slate-100">
                        {src.icon}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800">{src.name}</h3>
                        <p className="text-xs text-slate-500 font-medium">{src.type}</p>
                      </div>
                    </div>
                    {(src as { isNERDCAligned?: boolean }).isNERDCAligned && (
                      <span title="NERDC Aligned" className="flex items-center justify-center bg-emerald-50 text-emerald-600 w-6 h-6 rounded-full border border-emerald-100">
                        <CheckCircle size={12} />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mb-4 flex-1 line-clamp-3 leading-relaxed">
                    {src.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
                    <div className="flex gap-1 flex-wrap">
                      {src.coverage.slice(0, 2).map((c, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider">
                          {c}
                        </span>
                      ))}
                    </div>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Visit Site <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {activeTab === "notes" && (
        <Card className="p-6 border-2 border-slate-100">
          <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0 border border-emerald-100">
              <FileText className="w-8 h-8 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Lesson Note Templates</h2>
              <p className="text-slate-600 mt-1">Download standard lesson note structures aligned with NERDC format. Print these templates or fill them digitally to standardize your teaching plans.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors group">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Nursery / Early Years Format
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-4">Includes sections for play-based objectives, physical development goals, and interactive materials.</p>
              <button className="text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full justify-center">
                <Download size={16} /> Download Template (PDF)
              </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors group">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Primary Basic Format
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-4">Standard structure with behavioral objectives, instructional materials, presentation steps, and evaluation.</p>
              <button className="text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full justify-center">
                <Download size={16} /> Download Template (PDF)
              </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors group">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Junior Secondary (JSS) Format
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-4">Advanced structure including previous knowledge link, thematic evaluation, and practical assignment criteria.</p>
              <button className="text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full justify-center">
                <Download size={16} /> Download Template (PDF)
              </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl hover:border-emerald-300 transition-colors group">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                Senior Secondary (SSS) Format
              </h3>
              <p className="text-sm text-slate-500 mt-1 mb-4">Comprehensive format required for WAEC/NECO preparation, with specific terminal objectives and deep evaluations.</p>
              <button className="text-sm font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors w-full justify-center">
                <Download size={16} /> Download Template (PDF)
              </button>
            </div>
          </div>
        </Card>
      )}

      {activeTab === "aids" && (
        <Card className="p-6 border-2 border-slate-100">
          <div className="flex flex-col md:flex-row items-center gap-6 mb-8">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100">
              <MonitorPlay className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Digital Teaching Aids</h2>
              <p className="text-slate-600 mt-1">Recommended tools and platforms to make your classes more interactive and engaging for students.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-slate-200 rounded-xl flex flex-col h-full">
              <h3 className="font-bold text-slate-800 text-base">Kahoot!</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 flex-1">Game-based learning platform to create interactive quizzes and educational games.</p>
              <a href="https://kahoot.com" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                Visit Platform <ExternalLink size={14} />
              </a>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl flex flex-col h-full">
              <h3 className="font-bold text-slate-800 text-base">PhET Simulations</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 flex-1">Interactive math and science simulations from the University of Colorado Boulder.</p>
              <a href="https://phet.colorado.edu" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                Visit Platform <ExternalLink size={14} />
              </a>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl flex flex-col h-full">
              <h3 className="font-bold text-slate-800 text-base">Canva for Education</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 flex-1">Create engaging visual materials, presentations, and infographics for your classes.</p>
              <a href="https://www.canva.com/education" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                Visit Platform <ExternalLink size={14} />
              </a>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl flex flex-col h-full">
              <h3 className="font-bold text-slate-800 text-base">Quizlet</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 flex-1">Simple learning tools and flashcards to help students study and practice.</p>
              <a href="https://quizlet.com" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                Visit Platform <ExternalLink size={14} />
              </a>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl flex flex-col h-full">
              <h3 className="font-bold text-slate-800 text-base">GeoGebra</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 flex-1">Dynamic mathematics software for all levels of education that brings together geometry, algebra, spreadsheets, and graphing.</p>
              <a href="https://www.geogebra.org" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                Visit Platform <ExternalLink size={14} />
              </a>
            </div>
            
            <div className="p-4 border border-slate-200 rounded-xl flex flex-col h-full">
              <h3 className="font-bold text-slate-800 text-base">Google Classroom</h3>
              <p className="text-xs text-slate-500 mt-1 mb-4 flex-1">A blended learning platform for educational institutions to simplify creating, distributing, and grading assignments.</p>
              <a href="https://classroom.google.com" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                Visit Platform <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
