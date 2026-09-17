import { useEffect, useMemo, useState } from "react";
import type {
  Catalog,
  CatalogArtifact,
  CatalogPage,
  CatalogRef,
  CatalogSkill,
  CatalogUnavailable,
  Project,
} from "../../shared/types.js";
import { Button, Empty, Icon, Tag } from "./Primitives.js";
import { api } from "../lib/api.js";
import {
  addToTray,
  removeFromTray,
  trayItemKey
  
} from "../lib/catalogTray.js";
import type {TrayItem} from "../lib/catalogTray.js";
type Source = "wiki" | "skills";
type Preview =
  | { kind: "page"; page: CatalogPage }
  | { kind: "artifact"; skill: CatalogSkill; artifact: CatalogArtifact };
const behaviorLabels: Record<CatalogSkill["behavior"], string> = {
  read_only: "Read-only",
  writes_files: "Writes files",
  external_actions: "External actions",
  unknown: "Unknown behavior",
};
const artifactKindLabels: Record<CatalogArtifact["kind"], string> = {
  md: "MD",
  script: "Script",
  template: "Template",
  workflow: "Workflow",
};
const languageLabels: Record<string, string> = {
  python: "Python",
  shell: "Shell",
  javascript: "JavaScript",
};
function matches(haystacks: string[], query: string) {
  if (!query.trim()) return true;
  const needle = query.trim().toLowerCase();
  return haystacks.some((value) => value.toLowerCase().includes(needle));
}
function pageRef(page: CatalogPage): CatalogRef {
  return { kind: "wiki", pageId: page.id };
}
function artifactRef(skill: CatalogSkill, artifact: CatalogArtifact): CatalogRef {
  return { kind: "skill", skillId: skill.id, artifactId: artifact.id };
}
function ArtifactBadge({ artifact }: { artifact: CatalogArtifact }) {
  return (
    <Tag>
      {artifactKindLabels[artifact.kind]}
      {artifact.language ? ` · ${languageLabels[artifact.language]}` : ""}
    </Tag>
  );
}
function BehaviorPill({ behavior }: { behavior: CatalogSkill["behavior"] }) {
  return (
    <span
      className={`behavior-pill behavior-${behavior}`}
      title="Behavior label. File type never implies safety."
    >
      {behaviorLabels[behavior]}
    </span>
  );
}
function SkillCard({
  skill,
  onPreview,
  onAdd,
  isAdded,
}: {
  skill: CatalogSkill;
  onPreview: (preview: Preview) => void;
  onAdd: (skill: CatalogSkill, artifact: CatalogArtifact) => void;
  isAdded: (skill: CatalogSkill, artifact: CatalogArtifact) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="catalog-card">
      <div className="catalog-card-head">
        <div>
          <h4>{skill.name}</h4>
          <p>{skill.summary}</p>
        </div>
        <BehaviorPill behavior={skill.behavior} />
      </div>
      <div className="catalog-badges">
        {skill.artifacts.map((artifact) => (
          <ArtifactBadge key={artifact.id} artifact={artifact} />
        ))}
      </div>
      <Button
        variant="ghost"
        aria-expanded={expanded}
        onPress={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide artifacts" : "Expand artifacts"}
      </Button>
      {expanded && (
        <ul className="catalog-artifacts">
          {skill.artifacts.map((artifact) => (
            <li key={artifact.id}>
              <div>
                <ArtifactBadge artifact={artifact} />
                <span>{artifact.title}</span>
              </div>
              <div className="catalog-artifact-actions">
                <Button
                  variant="ghost"
                  onPress={() => onPreview({ kind: "artifact", skill, artifact })}
                >
                  Preview
                </Button>
                <Button
                  variant={isAdded(skill, artifact) ? "secondary" : "primary"}
                  isDisabled={isAdded(skill, artifact)}
                  onPress={() => onAdd(skill, artifact)}
                >
                  {isAdded(skill, artifact) ? "Added" : "Add to context tray"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
export function CatalogPicker({
  projects,
  mutate,
  onSaved,
}: {
  projects: Project[];
  mutate: (
    fn: () => Promise<unknown>,
    onConfirmed?: () => void,
  ) => Promise<void>;
  onSaved: (project: Project) => void;
}) {
  const [catalog, setCatalog] = useState<
    Catalog | CatalogUnavailable | null
  >(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState<Source>("wiki");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [name, setName] = useState("Catalog picks");
  const [lifetime, setLifetime] = useState<"short_term" | "long_term">(
    "short_term",
  );
  const [target, setTarget] = useState("");
  useEffect(() => {
    void api<Catalog | CatalogUnavailable>("/catalog")
      .then(setCatalog)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : "Catalog could not load.",
        ),
      );
  }, []);
  const available = catalog?.available === true ? catalog : null;
  const filteredPages = useMemo(
    () =>
      (available?.pages ?? []).filter((page) =>
        matches([page.title, page.project, page.topic, ...page.tags], query),
      ),
    [available, query],
  );
  const groupedPages = useMemo(() => {
    const groups = new Map<string, CatalogPage[]>();
    for (const page of filteredPages) {
      const key = `${page.project} / ${page.topic}`;
      groups.set(key, [...(groups.get(key) ?? []), page]);
    }
    return groups;
  }, [filteredPages]);
  const filteredSkills = useMemo(
    () =>
      (available?.skills ?? []).filter((skill) =>
        matches(
          [skill.name, skill.summary, ...skill.artifacts.map((a) => a.title)],
          query,
        ),
      ),
    [available, query],
  );
  function isAdded(key: string) {
    return tray.some((item) => item.key === key);
  }
  const wikiKey = (page: CatalogPage) => trayItemKey("wiki", page.id);
  const skillKey = (skillId: string, artifactId: string) =>
    trayItemKey("skill", `${skillId}:${artifactId}`);
  function addPage(page: CatalogPage) {
    const key = trayItemKey("wiki", page.id);
    setTray((current) =>
      addToTray(current, {
        key,
        label: page.title,
        sourceLabel: `${page.project} / ${page.topic}`,
        ref: pageRef(page),
      }),
    );
  }
  function addArtifact(skill: CatalogSkill, artifact: CatalogArtifact) {
    const key = trayItemKey("skill", `${skill.id}:${artifact.id}`);
    setTray((current) =>
      addToTray(current, {
        key,
        label: `${skill.name} · ${artifact.title}`,
        sourceLabel: behaviorLabels[skill.behavior],
        ref: artifactRef(skill, artifact),
      }),
    );
  }
  if (error)
    return (
      <Empty title="Catalog could not load.">
        <p>{error}</p>
      </Empty>
    );
  if (!catalog)
    return (
      <Empty title="Loading the wiki and skills catalog…">
        <p>Nothing is selected yet.</p>
      </Empty>
    );
  if (!catalog.available)
    return (
      <Empty title="Wiki/skills catalog is not available here.">
        <p>{catalog.reason}</p>
      </Empty>
    );
  return (
    <div className="content-view catalog-picker">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Before you start a chat</span>
          <h2>Browse wiki &amp; skills.</h2>
        </div>
        <Tag>Synthetic fixture catalog</Tag>
      </div>
      <p className="lede">
        Preview a wiki page or a skill artifact, then add it to the tray.
        Nothing here executes a script, opens a file outside this preview, or
        changes any permission. Saving the tray creates the same kind of
        source-linked context item chat excerpts already create.
      </p>
      <label className="sr-only" htmlFor="catalog-search">
        Search wiki and skills
      </label>
      <input
        id="catalog-search"
        type="search"
        placeholder="Search titles, tags and summaries…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="catalog-source-tabs" role="tablist" aria-label="Catalog source">
        <Button
          variant="ghost"
          aria-current={source === "wiki" ? "page" : undefined}
          onPress={() => setSource("wiki")}
        >
          <Icon name="context" />
          Wiki ({filteredPages.length})
        </Button>
        <Button
          variant="ghost"
          aria-current={source === "skills" ? "page" : undefined}
          onPress={() => setSource("skills")}
        >
          <Icon name="folder" />
          Skills ({filteredSkills.length})
        </Button>
      </div>
      <div className="catalog-body">
        <div className="catalog-list">
          {source === "wiki" ? (
            filteredPages.length === 0 ? (
              <p className="sidebar-hint">No wiki pages match that search.</p>
            ) : (
              [...groupedPages.entries()].map(([group, pages]) => (
                <section key={group} className="catalog-group">
                  <h5>{group}</h5>
                  <ul>
                    {pages.map((page) => {
                      return (
                        <li key={page.id}>
                          <button
                            type="button"
                            className="catalog-list-item"
                            onClick={() => setPreview({ kind: "page", page })}
                          >
                            <strong>{page.title}</strong>
                            <span>{page.summary}</span>
                          </button>
                          <Button
                            variant={isAdded(wikiKey(page)) ? "secondary" : "primary"}
                            isDisabled={isAdded(wikiKey(page))}
                            onPress={() => addPage(page)}
                          >
                            {isAdded(wikiKey(page)) ? "Added" : "Add to context tray"}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))
            )
          ) : filteredSkills.length === 0 ? (
            <p className="sidebar-hint">No skills match that search.</p>
          ) : (
            filteredSkills.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onPreview={setPreview}
                onAdd={addArtifact}
                isAdded={(sk, artifact) => isAdded(skillKey(sk.id, artifact.id))}
              />
            ))
          )}
        </div>
        <div className="catalog-preview">
          {preview ? (
            <>
              <span className="eyebrow">
                {preview.kind === "page" ? "Wiki page preview" : "Skill artifact preview"}
              </span>
              <h3>
                {preview.kind === "page"
                  ? preview.page.title
                  : `${preview.skill.name} · ${preview.artifact.title}`}
              </h3>
              <Tag warning>SYNTHETIC — fixture content</Tag>
              <pre>
                {preview.kind === "page"
                  ? preview.page.body
                  : preview.artifact.body}
              </pre>
              {preview.kind === "artifact" && (
                <p className="fine-print">
                  Behavior: {behaviorLabels[preview.skill.behavior]}. This
                  label describes the skill, not this file's type. Previewing
                  never runs it.
                </p>
              )}
              <Button
                variant="primary"
                onPress={() =>
                  preview.kind === "page"
                    ? addPage(preview.page)
                    : addArtifact(preview.skill, preview.artifact)
                }
              >
                Add to context tray
              </Button>
            </>
          ) : (
            <Empty title="Select something to preview.">
              <p>
                Choose a wiki page or expand a skill to preview one of its
                artifacts.
              </p>
            </Empty>
          )}
        </div>
        <div className="catalog-tray" aria-label="Context for this chat">
          <h4>Context for this chat</h4>
          {tray.length === 0 ? (
            <p className="sidebar-hint">Nothing added yet.</p>
          ) : (
            <ul>
              {tray.map((item) => (
                <li key={item.key}>
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.sourceLabel}</small>
                  </div>
                  <Button
                    variant="ghost"
                    aria-label={`Remove ${item.label} from context tray`}
                    onPress={() =>
                      setTray((current) => removeFromTray(current, item.key))
                    }
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {tray.length > 0 && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void mutate(async () => {
                  const refs = tray.map((item) => item.ref);
                  const project = target
                    ? await addToExistingProject(target, refs, projects)
                    : await api<Project>("/catalog/projects", {
                        refs,
                        name,
                        lifetime,
                      });
                  setTray([]);
                  onSaved(project);
                });
              }}
            >
              <label>
                Destination
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Create a new project</option>
                  {projects
                    .filter((project) => project.status === "active")
                    .map((project) => (
                      <option value={project.id} key={project.id}>
                        {project.name}
                      </option>
                    ))}
                </select>
              </label>
              {!target && (
                <div className="form-row">
                  <label>
                    Project name
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={120}
                      required
                    />
                  </label>
                  <label>
                    Lifetime
                    <select
                      value={lifetime}
                      onChange={(event) =>
                        setLifetime(event.target.value as typeof lifetime)
                      }
                    >
                      <option value="short_term">
                        Short-term · a bounded effort
                      </option>
                      <option value="long_term">
                        Long-term · ongoing context
                      </option>
                    </select>
                  </label>
                </div>
              )}
              <Button type="submit" variant="primary">
                Save to project
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
async function addToExistingProject(
  projectId: string,
  refs: import("../../shared/types.js").CatalogRef[],
  projects: Project[],
): Promise<Project> {
  await api(`/projects/${projectId}/catalog-context`, { refs });
  return projects.find((project) => project.id === projectId)!;
}
