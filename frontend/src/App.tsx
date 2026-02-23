import { Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { GoalsPage } from "./pages/GoalsPage";
import { HomePage } from "./pages/HomePage";
import { ResultsPage } from "./pages/ResultsPage";
import { SharePage } from "./pages/SharePage";

function App() {
  const dateStr = new Date().toLocaleDateString("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="appShell">
      <div className="appContainer">
        <header className="topHeader">
          <div className="flex flex-row justify-center items-center">
            <img src="/sasa.png" className="w-20 pr-2 pb-4 mr-0"/>
            <div className="flex flex-col space-between">
              <p className="headerDate">{dateStr}</p>
              <h1 className="headerTitle">Str<span className="e">eee</span>ak</h1>
            </div>
          </div>
          <div className="headerAvatar">test</div>
        </header>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/share" element={<SharePage />} />
        </Routes>
      </div>
      <NavBar />
    </div>
  );
}

export default App;
