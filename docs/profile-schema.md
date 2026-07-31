# Profile Schema

This document defines the structured schema for a user's "profile context" — the
structured, machine-readable equivalent of a free-text profile dump (e.g.
`januprof.txt`) that would otherwise be pasted into an LLM chat by hand every time.

The schema is used to:
- Store a user's profile data once, in a consistent format
- Feed structured context into job-matching / cover-letter / resume-tailoring prompts
- Allow partial updates (e.g. add a project) without rewriting a wall of free text
- Encode not just facts but *how* the AI should use them (e.g. which experience to
  lead with for which type of role)

## Top-level fields

| Field             | Type              | Required | Description                                          |
|-------------------|-------------------|----------|--------------------------------------------------------|
| `personal`        | object            | yes      | Name, contact, location, availability, summary        |
| `education`       | array of objects  | yes      | Degrees, institutions, dates, coursework               |
| `thesis`          | object or null    | no       | Thesis/capstone: problem, methodology, results          |
| `experience`      | array of objects  | yes      | Work / research assistant / internship history          |
| `projects`        | array of objects  | yes      | Hackathon, coursework, or personal projects              |
| `skills`          | array of objects  | yes      | Skills grouped by category                              |
| `certifications`  | array of objects  | no       | Certifications and licenses                              |
| `languages`       | array of objects  | no       | Spoken languages and proficiency level                   |
| `links`           | object            | no       | GitHub, LinkedIn, portfolio, etc.                        |
| `ai_instructions` | object            | no       | Tailoring rules for AI-generated cover letters/resumes    |
| `additional_information` | array of objects | no | Catch-all for extra projects, experience, awards, publications, or volunteer work that don't fit the main sections |

## Field definitions

### `personal`
| Field                | Type   | Description                                   |
|----------------------|--------|--------------------------------------------------|
| `full_name`          | string | Full name                                      |
| `email`              | string | Contact email                                  |
| `location`           | string | City, Country                                  |
| `availability`       | string | e.g. "Open to full-time positions across Europe" |
| `work_authorization`  | string | e.g. "EU work authorization"                    |
| `summary`            | string | Short professional headline/summary             |

### `education[]`
| Field                  | Type             | Description                             |
|------------------------|------------------|--------------------------------------------|
| `degree`               | string           | e.g. "Master of Science in Data Science"  |
| `institution`          | string           | School/university name                    |
| `location`             | string           | City, Country                              |
| `start_date`           | string           | ISO 8601 (`YYYY-MM`)                       |
| `end_date`             | string           | ISO 8601 (`YYYY-MM`) or `"present"`         |
| `relevant_coursework`  | array of strings | Optional                                   |

### `thesis`
| Field               | Type             | Description                                       |
|---------------------|------------------|------------------------------------------------------|
| `title`             | string           | Thesis title                                       |
| `institution`       | string           | Institution it was completed at                    |
| `supervisors`       | array of strings | Supervisor name(s) / group                          |
| `submitted`         | string           | ISO 8601 (`YYYY-MM`)                                |
| `problem`           | string           | The problem statement / motivation                  |
| `research_questions`| array of strings | Key research questions                              |
| `methodology`       | array of strings | Methods/approach as bullet points                    |
| `key_results`       | array of strings | Key findings as bullet points                        |
| `technologies`      | array of strings | Tools, frameworks, models used                       |

### `experience[]`
| Field             | Type             | Description                                          |
|-------------------|------------------|---------------------------------------------------------|
| `company`         | string           | Employer / institution name                            |
| `title`           | string           | Role title                                              |
| `location`        | string           | City, Country / "Remote"                                |
| `start_date`      | string           | ISO 8601 (`YYYY-MM`)                                     |
| `end_date`        | string           | ISO 8601 (`YYYY-MM`) or `"present"`                       |
| `project_context` | string           | 1-2 sentence description of the project/team              |
| `highlights`      | array of strings | Bullet points of accomplishments                          |
| `technologies`    | array of strings | Technologies used                                         |
| `reference_quote` | string           | Optional quote from a reference letter/manager             |

### `projects[]`
| Field          | Type             | Description                                             |
|----------------|------------------|-------------------------------------------------------------|
| `name`         | string           | Project name                                              |
| `context`      | string           | e.g. "Hackathon", "Coursework", "Team Project"              |
| `date`         | string           | ISO 8601 (`YYYY-MM`)                                        |
| `team_size`    | integer          | Optional                                                    |
| `problem`      | string           | Problem statement                                          |
| `highlights`   | array of strings | Key technical details / accomplishments                     |
| `results`      | array of strings | Optional quantified outcomes (metrics, rankings, etc.)      |
| `technologies` | array of strings | Technologies used                                          |
| `link`         | string           | Repo/demo URL (optional)                                    |

### `skills[]`
| Field      | Type             | Description                                    |
|------------|------------------|----------------------------------------------------|
| `category` | string           | e.g. "Programming Languages", "ML & Frameworks"    |
| `items`    | array of strings | Skill names in that category                        |

### `certifications[]`
| Field    | Type   | Description                |
|----------|--------|------------------------------|
| `name`   | string | Certification name          |
| `issuer` | string | Issuing organization        |

### `languages[]`
| Field         | Type   | Description                              |
|---------------|--------|---------------------------------------------|
| `language`    | string | Language name                              |
| `proficiency` | string | e.g. "C1", "B1", "Native"                   |

### `links`
| Field       | Type   | Description        |
|-------------|--------|---------------------|
| `github`    | string | GitHub profile URL  |
| `linkedin`  | string | LinkedIn profile URL |
| `portfolio` | string | Personal site URL   |

### `ai_instructions`
Rules that steer how the profile is used when generating tailored content (cover
letters, resume bullet selection, etc.). This lets the AI make the same judgment
calls a person would when deciding what to emphasize per job.

| Field              | Type             | Description                                            |
|--------------------|------------------|------------------------------------------------------------|
| `style`            | string           | Tone/format guidance, e.g. "Precise, no fluff, max 4 paragraphs" |
| `tailoring_rules`  | array of strings | Rules mapping profile strengths to role types                |

### `additional_information[]`
A flexible, low-friction section for entries that don't cleanly fit `experience` or
`projects` (e.g. a minor side project, volunteer work, a publication, an award) —
so this data can still be captured instead of being dropped or forced into the
wrong section.

| Field          | Type             | Description                                              |
|----------------|------------------|--------------------------------------------------------------|
| `type`         | string           | e.g. "project", "experience", "award", "publication", "volunteer" |
| `title`        | string           | Name/title of the entry                                    |
| `description`  | string           | Free-form description                                      |
| `date`         | string           | ISO 8601 (`YYYY-MM`), optional                              |
| `technologies` | array of strings | Optional                                                    |
| `link`         | string           | Optional URL                                                |

## Example

Values below are fully fictional placeholders — no real personal data.

```json
{
  "personal": {
    "full_name": "Sam Rivera",
    "email": "sam.rivera@example.com",
    "location": "Lisbon, Portugal",
    "availability": "Open to full-time positions starting September 2026",
    "work_authorization": "EU work authorization",
    "summary": "Backend-leaning software engineer with experience building distributed systems, developer tooling, and cloud infrastructure."
  },
  "education": [
    {
      "degree": "Master of Science in Computer Science",
      "institution": "Example Institute of Technology",
      "location": "Lisbon, Portugal",
      "start_date": "2023-09",
      "end_date": "2025-07",
      "relevant_coursework": ["Distributed Systems", "Database Internals", "Cloud Computing", "Compiler Design"]
    },
    {
      "degree": "Bachelor of Science in Software Engineering",
      "institution": "Example State University",
      "location": "Porto, Portugal",
      "start_date": "2019-09",
      "end_date": "2023-06",
      "relevant_coursework": []
    }
  ],
  "thesis": {
    "title": "Adaptive Sharding Strategies for Multi-Tenant Time-Series Databases",
    "institution": "Example Institute of Technology, Systems Research Lab",
    "supervisors": ["Dr. Elena Kovacs", "Prof. Dr. Michael Berg"],
    "submitted": "2025-06",
    "problem": "Fixed sharding strategies in multi-tenant time-series databases cause hot-partition bottlenecks when tenant write volume is highly skewed.",
    "research_questions": [
      "How much does write-skew across tenants degrade throughput under static hash sharding?",
      "Can workload-aware dynamic re-sharding reduce tail latency without excessive migration overhead?"
    ],
    "methodology": [
      "Implemented a dynamic re-sharding controller on top of an open-source time-series database",
      "Simulated multi-tenant write workloads with varying skew coefficients",
      "Compared static hash sharding, range sharding, and the proposed adaptive strategy under identical load"
    ],
    "key_results": [
      "Adaptive sharding reduced p99 write latency by roughly 35% under high-skew workloads",
      "Migration overhead was negligible below a re-sharding frequency threshold identified experimentally",
      "Gains were minimal under low-skew workloads, where static sharding remained competitive"
    ],
    "technologies": ["Go", "gRPC", "Time-series databases", "Kubernetes", "Prometheus"]
  },
  "experience": [
    {
      "company": "Example Cloud Systems Inc.",
      "title": "Backend Engineering Intern",
      "location": "Remote",
      "start_date": "2024-06",
      "end_date": "2024-09",
      "project_context": "Internal platform team responsible for the deployment pipeline used by 40+ engineering teams.",
      "highlights": [
        "Rebuilt the deployment queue service in Go, cutting average deploy time by 30%",
        "Added structured tracing across the pipeline, reducing incident triage time",
        "Wrote internal documentation adopted as the team's onboarding reference"
      ],
      "technologies": ["Go", "PostgreSQL", "Kubernetes", "gRPC"],
      "reference_quote": "Quickly ramped up on an unfamiliar codebase and shipped changes other teams depended on within weeks."
    }
  ],
  "projects": [
    {
      "name": "Pathfinder — Self-Hosted CI Log Search",
      "context": "Hackathon",
      "date": "2025-11",
      "team_size": 4,
      "problem": "Engineers wasted time scrolling through massive raw CI logs to find the cause of a failed build.",
      "highlights": [
        "Built a log ingestion and full-text search service with sub-second query latency",
        "Implemented automatic failure-pattern clustering to surface likely root causes first",
        "Shipped a browser extension that links failed CI runs directly to matching past incidents"
      ],
      "results": ["2nd place among 22 teams"],
      "technologies": ["Rust", "Tantivy", "React", "Docker"],
      "link": null
    },
    {
      "name": "RouteWise — Delivery Batch Optimizer",
      "context": "Coursework",
      "date": "2024-12",
      "team_size": 3,
      "problem": "A simulated last-mile delivery service needed to batch and route orders under tight time windows.",
      "highlights": [
        "Modeled the problem as a constrained vehicle routing optimization",
        "Implemented a simulated-annealing heuristic to find near-optimal batches within time limits"
      ],
      "results": ["Reduced simulated average delivery time by 18% versus greedy baseline"],
      "technologies": ["Python", "OR-Tools", "Simulated Annealing"],
      "link": null
    }
  ],
  "skills": [
    { "category": "Programming Languages", "items": ["Go", "Rust", "Python", "TypeScript"] },
    { "category": "Infrastructure", "items": ["Kubernetes", "Docker", "Terraform", "AWS"] },
    { "category": "Data & Storage", "items": ["PostgreSQL", "Time-series databases", "gRPC", "Kafka"] }
  ],
  "certifications": [
    { "name": "Certified Kubernetes Application Developer", "issuer": "CNCF" },
    { "name": "AWS Certified Solutions Architect – Associate", "issuer": "Amazon Web Services" }
  ],
  "languages": [
    { "language": "English", "proficiency": "C1" },
    { "language": "Portuguese", "proficiency": "Native" },
    { "language": "Spanish", "proficiency": "B2" }
  ],
  "links": {
    "github": "https://github.com/example",
    "linkedin": "https://linkedin.com/in/example",
    "portfolio": null
  },
  "ai_instructions": {
    "style": "Precise, to the point, no fluff. Maximum 4 paragraphs, each with one clear point.",
    "tailoring_rules": [
      "Thesis is the strongest differentiator for infrastructure/distributed-systems roles — lead with it for those roles",
      "The CI tooling internship is the strongest differentiator for developer-tools/platform roles",
      "Always evaluate job requirements against the profile before writing",
      "Address relocation willingness if the job is outside the home base city/country"
    ]
  },
  "additional_information": [
    {
      "type": "award",
      "title": "Best Newcomer, Example Regional Coding League",
      "description": "Awarded for the highest-scoring first-time entrant across 300+ participants.",
      "date": "2023-05",
      "technologies": [],
      "link": null
    },
    {
      "type": "volunteer",
      "title": "Mentor, Example Code Club",
      "description": "Weekly mentoring for beginner programmers on data structures fundamentals.",
      "date": "2022-01",
      "technologies": [],
      "link": null
    },
    {
      "type": "publication",
      "title": "Notes on Cache Invalidation Patterns for Edge Deployments",
      "description": "Short technical write-up published on a personal engineering blog.",
      "date": "2025-03",
      "technologies": ["Redis", "CDN"],
      "link": "https://example.com/blog/cache-invalidation-edge"
    }
  ]
}
```
