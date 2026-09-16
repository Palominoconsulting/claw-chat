import { useState } from "react";
import type { Conversation, Project } from "../../shared/types.js";
import { Button, Icon } from "./Primitives.js";
function Tree({
  rows,
  parent,
  visited,
  active,
  select,
}: {
  rows: Conversation[];
  parent: string | null;
  visited: Set<string>;
  active: string;
  select: (key: string) => void;
}) {
  return (
    <ul className="conversation-tree">
      {rows
        .filter(
          (row) =>
            row.parentKey === parent ||
            (parent === null &&
              row.parentKey &&
              !rows.some((other) => other.key === row.parentKey)),
        )
        .filter((row) => !visited.has(row.key))
        .map((row) => (
          <li key={row.key}>
            <Button
              variant="ghost"
              aria-current={active === row.key ? "page" : undefined}
              onPress={() => select(row.key)}
            >
              <Icon name="chat" />
              <span>
                {row.title}
                <small>
                  {row.lineage === "incomplete"
                    ? "Incomplete lineage"
                    : row.parentKey
                      ? "Reported child"
                      : "Conversation"}
                </small>
              </span>
            </Button>
            {visited.size < 10 && (
              <Tree
                rows={rows}
                parent={row.key}
                visited={new Set([...visited, row.key])}
                active={active}
                select={select}
              />
            )}
          </li>
        ))}
    </ul>
  );
}
export function Sidebar({
  projects,
  conversations,
  projectId,
  conversationKey,
  onProject,
  onConversation,
  onHome,
  onSetup,
  onCatalog,
  mobileOpen,
  inert = false,
}: {
  projects: Project[];
  conversations: Conversation[];
  projectId: string;
  conversationKey: string;
  onProject: (id: string) => void;
  onConversation: (key: string) => void;
  onHome: () => void;
  onSetup: () => void;
  onCatalog: () => void;
  mobileOpen: boolean;
  inert?: boolean;
}) {
  const [filter, setFilter] = useState("active");
  return (
    <aside
      className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}
      inert={inert}
    >
      <Button variant="ghost" className="wordmark" onPress={onHome}>
        <span className="brand-mark">c</span>claw<span>chat</span>
        <small>LOCAL</small>
      </Button>
      <div className="sidebar-inner">
        <Button variant="secondary" className="catalog-entry" onPress={onCatalog}>
          <Icon name="context" />
          Browse wiki &amp; skills
        </Button>
        <div className="sidebar-caption">
          <span>Your projects</span>
          <span>{projects.length.toString().padStart(2, "0")}</span>
        </div>
        <label className="sr-only" htmlFor="project-filter">
          Filter projects
        </label>
        <select
          id="project-filter"
          className="sidebar-filter"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="active">Active projects</option>
          <option value="short_term">Short-term</option>
          <option value="long_term">Long-term</option>
          <option value="archived">Archived</option>
        </select>
        <nav aria-label="Projects" className="projects">
          {projects
            .filter((project) =>
              filter === "archived"
                ? project.status === "archived"
                : project.status === "active" &&
                  (filter === "active" || project.lifetime === filter),
            )
            .map((project) => (
              <Button
                key={project.id}
                variant="ghost"
                aria-current={projectId === project.id ? "page" : undefined}
                onPress={() => onProject(project.id)}
              >
                <Icon name="folder" />
                <span>
                  {project.name}
                  <small>
                    {project.lifetime === "long_term"
                      ? "Long-term context"
                      : "Short-term project"}
                  </small>
                </span>
              </Button>
            ))}
          {projects.length === 0 && (
            <p className="sidebar-hint">
              Save a few messages.
              <br />
              Give an idea a home.
            </p>
          )}
        </nav>
        <div className="sidebar-caption conversations-caption">
          <span>Conversations</span>
          <span>{conversations.length.toString().padStart(2, "0")}</span>
        </div>
        <nav aria-label="Conversations">
          <Tree
            rows={conversations}
            parent={null}
            visited={new Set()}
            active={conversationKey}
            select={onConversation}
          />
        </nav>
      </div>
      <div className="sidebar-footer">
        <span className="local-dot" />
        Stored on this device
        <Button
          variant="ghost"
          aria-label="Connection settings"
          onPress={onSetup}
        >
          <Icon name="settings" />
        </Button>
      </div>
    </aside>
  );
}
