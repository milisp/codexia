import { useState, useEffect } from "react";
import { Loader2, FolderOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigationStore } from "@/stores/navigationStore";
import { useFolderStore } from "@/stores/FolderStore";
import { useCodexStore } from "@/stores/codex";
import { useLayoutStore } from "@/stores/settings/layoutStore";
import { invoke } from "@/lib/tauri-proxy";
import { isRemoteRuntime } from "@/lib/tauri-proxy";
import { open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { getProjects } from "@/lib/sessions";

interface FileSystemProject {
  path: string;
}

interface UnifiedProject {
  path: string;
  hasCodex: boolean;
}

export function ProjectPanel() {
  const [codexProjects, setCodexProjects] = useState<FileSystemProject[]>([]);
  const [unifiedProjects, setUnifiedProjects] = useState<UnifiedProject[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  const {
    setMainView,
    setSidebarTab,
    setSubTab,
    setSelectedAgent,
    selectedAgent,
  } = useNavigationStore();
  const { setCurrentFolder } = useFolderStore();
  const { setCwd } = useCodexStore();
  const { setFileTree, setChatPane } = useLayoutStore();

  // Load project lists and scanned projects
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const [codexList, scannedList, sessionProjects] = await Promise.all([
          invoke<FileSystemProject[]>("read_codex_config").catch(() => []),
          invoke<Array<{ name: string; path: string }>>(
            "get_scanned_projects",
          ).catch(() => []),
          getProjects(),
        ]);

        // Combine all projects
        const existingPaths = new Set(codexList.map((p) => p.path));

        // Add scanned projects
        const scannedCodexProjects = scannedList
          .filter((p) => !existingPaths.has(p.path))
          .map((p) => {
            existingPaths.add(p.path);
            return { path: p.path };
          });

        // Add session projects that aren't already included
        const sessionCodexProjects = Array.from(sessionProjects)
          .filter((p) => !existingPaths.has(p))
          .map((p) => ({ path: p }));

        const allProjects = [
          ...codexList,
          ...scannedCodexProjects,
          ...sessionCodexProjects,
        ];

        setCodexProjects(allProjects);
      } catch (error) {
        console.error("Failed to load projects:", error);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  // Map codex projects to unified format
  useEffect(() => {
    const unifiedProjects = codexProjects.map((project) => ({
      path: project.path,
      hasCodex: true,
    }));

    setUnifiedProjects(unifiedProjects);
  }, [codexProjects]);

  const handleCCClick = (project: UnifiedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project.hasCodex) return;

    setCurrentFolder(project.path);
    setCwd(project.path);
    setFileTree(true);
    setChatPane(true);
    setMainView("cc");
    setSidebarTab("cc");
    setSubTab("main");
  };

  const handleCodexClick = (project: UnifiedProject, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!project.hasCodex) return;

    setCurrentFolder(project.path);
    setCwd(project.path);
    setFileTree(true);
    setChatPane(true);
    setMainView("codex");
    setSidebarTab("codex");
    setSubTab("main");
    setSelectedAgent("codex");
  };

  const handleProjectNameClick = (
    project: UnifiedProject,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (!project.hasCodex) return;

    setCurrentFolder(project.path);
    setCwd(project.path);
    setFileTree(true);
    setChatPane(true);

    if (selectedAgent === "cc") {
      setMainView("cc");
      setSidebarTab("cc");
    } else {
      setMainView("codex");
      setSidebarTab("codex");
      setSelectedAgent("codex");
    }
    setSubTab("main");
  };

  const selectNewProject = async () => {
    try {
      if (isRemoteRuntime()) {
        alert("Opening projects is only available from the desktop app.");
        return;
      }

      const result = await open({
        directory: true,
        multiple: false,
      });

      if (result) {
        setCurrentFolder(result);
        setCwd(result);
        setFileTree(true);
        setChatPane(true);
        if (selectedAgent === "codex" || selectedAgent === "cc") {
          setMainView(selectedAgent);
          setSidebarTab(selectedAgent);
        }
        // Reload projects
        const codexList = await invoke<FileSystemProject[]>(
          "read_codex_config",
        ).catch(() => []);
        setCodexProjects(codexList);
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
      toast.error("Failed to open project");
    }
  };

  const matchesSearchTerm = (project: UnifiedProject) => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;

    const normalizedPath = project.path.toLowerCase();
    if (normalizedPath.includes(term)) return true;

    const folderName = project.path.split(/[/\\]/).pop()?.toLowerCase() ?? "";
    return folderName.includes(term);
  };

  const filteredProjects = unifiedProjects.filter(matchesSearchTerm);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin" />
          <div className="text-sm text-muted-foreground">
            Loading projects...
          </div>
        </div>
      </div>
    );
  }

  const renderProjectRow = (project: UnifiedProject) => {
    const projectName = project.path.split(/[/\\]/).pop() || project.path;

    return (
      <div className="flex items-stretch gap-4 p-4 rounded-lg border hover:bg-accent transition-colors">


        <button
          onClick={(e) => handleCodexClick(project, e)}
          className="text-xs px-2 py-1 rounded border text-muted-foreground hover:text-accent-foreground hover:bg-cyan-400 transition-colors cursor-pointer"
          title="Open in Codex"
        >
          codex
        </button>
        <div
          onClick={(e) => handleProjectNameClick(project, e)}
          className="flex-1 min-w-0 cursor-pointer"
        >
          <div className="font-medium truncate">{projectName}</div>
          <div className="text-sm text-muted-foreground break-words">
            {project.path}
          </div>
        </div>
        <button
          onClick={(e) => handleCCClick(project, e)}
          className="text-xs px-2 py-1 rounded border text-muted-foreground hover:text-accent-foreground hover:bg-orange-400 transition-colors cursor-pointer"
          title="Open in Claude Code"
        >
          cc
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex-shrink-0 border-b bg-background px-4 py-3 sm:px-6 sm:py-4">
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">Projects</h2>
            <Button
              onClick={selectNewProject}
              size="sm"
              className="w-full sm:w-auto"
            >
              <Plus className="w-3 h-3" />
              Open Project
            </Button>
          </div>
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filteredProjects.length === 0 ? (
          <div className="p-4 sm:p-6">
            <Card>
              <CardContent className="p-6 text-center">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  No projects found
                </h3>
                <p className="text-muted-foreground">
                  {searchTerm
                    ? "Try a different search term"
                    : "Open a project to get started"}
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-1 p-4 sm:p-6">
            {filteredProjects.map((project) => (
              <div key={project.path}>{renderProjectRow(project)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
