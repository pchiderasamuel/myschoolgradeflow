import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RESOURCE_SOURCES } from "@/components/school/data/resourceSources";
import { BookOpen, Search, ExternalLink, Bookmark, CheckCircle } from "lucide-react";

export default function ResourcesPage() {
  const [activeTab, setActiveTab] = useState<"sources" | "notes">("sources");
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
        <p className="text-sm text-slate-500 mt-1">Access external resources and educational notes aligned with NAPPS/NERDC</p>
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("sources")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "sources" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          External Sources
        </button>
        <button
          onClick={() => setActiveTab("notes")}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
            activeTab === "notes" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
          }`}
        >
          E-Notes (Coming Soon)
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
        <Card className="p-12 text-center border-2 border-slate-100 border-dashed">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-800 mb-2">E-Notes Library</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            The comprehensive E-Notes library with downloadable PDFs for all classes and subjects is currently being integrated into the new staff portal. Please check back soon.
          </p>
        </Card>
      )}
    </div>
  );
}
