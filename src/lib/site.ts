export const REPO_URL: string =
  import.meta.env.VITE_REPO_URL || 'https://github.com/DaLuSt/Vision-Zero-Monitor';
export const DOCS_URL = `${REPO_URL}/blob/main/docs`;
export const ISSUES_URL = `${REPO_URL}/issues/new`;
export const MAINTAINER_URL = 'https://github.com/DaLuSt';
export const MAINTAINER_LINKEDIN_URL = 'https://www.linkedin.com/in/daansteur';
export const WORKFLOW_RUNS_URL = `${REPO_URL}/actions/workflows/update-data.yml`;

/** Zenodo DOIs: the concept DOI resolves to the latest release; DOI_V1 is release 1.0.0. */
export const DOI_ALL = '10.5281/zenodo.23437733';
export const DOI_V1 = '10.5281/zenodo.23437734';
