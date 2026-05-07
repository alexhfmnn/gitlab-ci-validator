import './Footer.css';

export function Footer() {
  const username = import.meta.env.VITE_GITHUB_USERNAME;

  return (
    <footer className="app-footer">
      {username ? (
        <a
          href={`https://github.com/${username}/gitlab-ci-validator`}
          target="_blank"
          rel="noreferrer"
        >
          GitHub repository
        </a>
      ) : (
        <span>GitHub repository</span>
      )}
    </footer>
  );
}
