import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Projects from './pages/Projects';
import MessageCenter from './pages/MessageCenter';
import Broadcast from './pages/Broadcast';
import ScheduledEvents from './pages/ScheduledEvents';
import Statistics from './pages/Statistics';
import RichMenu from './pages/RichMenu';
import AdminPage from './pages/AdminPage';
import Questionnaire from './pages/Questionnaire';
import LiffQuestionnaire from './pages/LiffQuestionnaire';
import SocialRadar from './pages/SocialRadar';
import AiInsight from './pages/AiInsight';
import api, { preloadPagesData } from './api';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { TaskProvider, useTask } from './contexts/TaskContext';
import Toast from './components/Toast';
import StatusIndicator from './components/StatusIndicator';
import { LayoutDashboard, Clock, LogOut, MessageSquare, BarChart3, Send, Shield, LayoutGrid, ClipboardList, Workflow, Database, Radar, BrainCircuit, Menu, ChevronLeft } from 'lucide-react';
import RuleDesigner from './pages/RuleDesigner';
import DatabaseViewer from './pages/DatabaseViewer';

import CustomerCenter from './pages/CustomerCenter';
import { Users } from 'lucide-react';

const GlobalLoading = () => (
  <div className="overlay" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
      <div className="spinner"></div>
      <div style={{ color: 'var(--primary-yellow)', fontWeight: 'bold', letterSpacing: '1px' }}>載入中...</div>
    </div>
  </div>
);

const GOOGLE_CLIENT_ID = "909213734319-feblc4e1vhgu7e0r340e43h9aabc8iqf.apps.googleusercontent.com";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <GlobalLoading />;
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, isLoading } = useAuth();
  if (isLoading) return <GlobalLoading />;
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (user?.role !== 'admin') return <Navigate to="/" />;
  return children;
};

const PAGE_ROUTE_MAP = {
  'MessageCenter': 'messages',
  'Projects': 'projects',
  'Broadcast': 'broadcast',
  'ScheduledEvents': 'scheduled-events',
  'Statistics': 'statistics',
  'RichMenu': 'richmenu',
  'Questionnaire': 'questionnaire',
  'RuleDesigner': 'ruledesigner',
  'DatabaseViewer': 'dbviewer',
  'CustomerCenter': 'customers',
  'SocialRadar': 'social-radar',
  'AiInsight': 'ai-insight'
};

const PAGE_ICON_MAP = {
  'MessageCenter': MessageSquare,
  'Projects': LayoutDashboard,
  'Broadcast': Send,
  'ScheduledEvents': Clock,
  'Statistics': BarChart3,
  'RichMenu': LayoutGrid,
  'Questionnaire': ClipboardList,
  'RuleDesigner': Workflow,
  'DatabaseViewer': Database,
  'CustomerCenter': Users,
  'SocialRadar': Radar,
  'AiInsight': BrainCircuit
};

import { Tooltip as MuiTooltip } from '@mui/material';
import { HelpCircle } from 'lucide-react';

const Tooltip = ({ title, children }) => {
  if (!title) return children;
  return <MuiTooltip title={<div style={{ whiteSpace: 'pre-line' }}>{title}</div>} arrow placement="left">{children}</MuiTooltip>;
};

const HELP_CONTENT_MAP = {
  'messages': '訊息中心：與用戶進行 1對1 即時對話，查看歷史紀錄與標籤設定。',
  'projects': '自動旅程：設定用戶進入後的自動化流程，包含定時推送訊息與標籤觸發。',
  'broadcast': '群發訊息：針對全體或指定標籤受眾進行即時或預約群發。',
  'scheduled-events': '定時排程：查看與管理所有已排定的訊息推送任務。',
  'statistics': '綜合數據：查看追蹤人數、訊息量、點擊率等各項指標報表。',
  'richmenu': '圖文選單：管理 LINE 底部選單。支援草稿、發佈、定時切換與連結功能。',
  'questionnaire': '問卷管理：建立與管理互動式問卷，收集用戶回饋與偏好。',
  'ruledesigner': '關鍵字回覆：設定當用戶輸入特定關鍵字時系統自動回覆的內容。',
  'dbviewer': '資料庫檢視：高級工具，用於直接檢視系統底層資料表狀態。',
  'customers': '客戶中心：管理客戶基本資料與進階屬性。',
  'admin': '管理員後台：管理系統用戶、帳號權限與全域設定。',
  'social-radar': '網路聲量雷達：監測網路社群聲量與輿情分析。',
  'ai-insight': 'AI 洞察助理：AI 智能數據分析與洞察建議。'
};

const MainLayout = () => {
  const { isAuthenticated, logout, user, myOAs, isLoading } = useAuth();
  const { taskState } = useTask();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  if (isLoading) return <GlobalLoading />;

  React.useEffect(() => {
    if (isAuthenticated && myOAs && myOAs.length > 0) {
      // 預載所有權限的所有頁面資料
      myOAs.forEach(oa => {
        if (oa.id) {
          preloadPagesData(oa.id);
        }
      });
    }
  }, [isAuthenticated, myOAs]);

  const getHelpContent = () => {
    if (location.pathname === '/admin') return HELP_CONTENT_MAP['admin'];
    const parts = location.pathname.split('/');
    const lastPart = parts[parts.length - 1];
    return HELP_CONTENT_MAP[lastPart] || '說明：此頁面提供系統功能設定。如有疑問請聯繫管理員。';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {isAuthenticated && location.pathname !== '/login' && (
        <nav style={{ 
          width: isSidebarCollapsed ? '80px' : '260px', 
          transition: 'width 0.3s ease',
          backgroundColor: '#111', 
          borderRight: '1px solid #333', 
          padding: isSidebarCollapsed ? '30px 10px' : '30px 20px', 
          display: 'flex', 
          flexDirection: 'column', 
          overflowY: 'auto',
          position: 'relative'
        }}>
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            style={{
              position: 'absolute',
              top: '25px',
              right: isSidebarCollapsed ? '25px' : '20px',
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '5px'
            }}
          >
            {isSidebarCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
          </button>

          <h2 className="text-yellow" style={{ marginBottom: '40px', fontSize: isSidebarCollapsed ? '16px' : '24px', textAlign: isSidebarCollapsed ? 'center' : 'left', marginTop: isSidebarCollapsed ? '40px' : '0' }}>
            {isSidebarCollapsed ? 'SP' : 'SuperPages'}
          </h2>

          {user?.role === 'admin' && (
            <div style={{ marginBottom: '20px' }}>
              <Link
                to="/admin"
                style={{
                  color: 'white',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '8px',
                  background: location.pathname === '/admin' ? '#333' : '#222'
                }}
                className="nav-link"
              >
                <Shield size={20} className="text-yellow" /> {!isSidebarCollapsed && '管理員後台'}
              </Link>
            </div>
          )}

          <div style={{ flex: 1 }}>
            {myOAs.map(oa => (
              <div key={oa.id} style={{ marginBottom: '25px' }}>
                <div style={{ color: '#888', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', paddingLeft: isSidebarCollapsed ? '0' : '12px', textAlign: isSidebarCollapsed ? 'center' : 'left', textTransform: 'uppercase' }}>
                  {isSidebarCollapsed ? oa.oa_name.substring(0, 2) : oa.oa_name}
                </div>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {oa.pages && oa.pages.map(page => {
                    const RouteIcon = PAGE_ICON_MAP[page.name] || LayoutDashboard;
                    const routePath = PAGE_ROUTE_MAP[page.name] || 'projects';
                    const fullPath = `/oa/${oa.id}/${routePath}`;
                    const isActive = location.pathname.startsWith(fullPath);

                    const displayName = page.name === 'Projects' ? '自動旅程' :
                        page.name === 'Questionnaire' ? '問卷管理' :
                          page.name === 'RuleDesigner' ? '關鍵字回覆' :
                            page.name === 'DatabaseViewer' ? '資料庫檢視' :
                                page.name === 'CustomerCenter' ? '客戶中心' :
                                  page.description;

                    return (
                      <React.Fragment key={page.id}>
                      <li style={{ marginBottom: '5px' }}>
                        <Link
                          to={fullPath}
                          style={{
                            color: 'white',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            fontSize: '14px',
                            backgroundColor: isActive ? '#333' : 'transparent',
                            borderLeft: isActive ? '4px solid #FFD700' : '4px solid transparent'
                          }}
                          className="nav-link"
                        >
                          <RouteIcon size={18} className="text-yellow" /> {!isSidebarCollapsed && displayName}
                        </Link>
                      </li>
                      {page.name === 'Questionnaire' && (
                        <li style={{ marginBottom: '5px' }}>
                          <Link
                            to={`/oa/${oa.id}/liff-questionnaire`}
                            style={{
                              color: 'white',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                              gap: '12px',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              fontSize: '14px',
                              backgroundColor: location.pathname.startsWith(`/oa/${oa.id}/liff-questionnaire`) ? '#333' : 'transparent',
                              borderLeft: location.pathname.startsWith(`/oa/${oa.id}/liff-questionnaire`) ? '4px solid #FFD700' : '4px solid transparent'
                            }}
                            className="nav-link"
                          >
                            <ClipboardList size={18} className="text-yellow" /> {!isSidebarCollapsed && 'LIFF 問卷'}
                          </Link>
                        </li>
                      )}
                      </React.Fragment>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #333', paddingTop: '20px' }}>
            {!isSidebarCollapsed && (
              <div style={{ color: '#888', marginBottom: '10px', fontSize: '0.9em', paddingLeft: '12px' }}>
                {user?.email}
              </div>
            )}
            <button onClick={logout} style={{ background: 'transparent', color: '#B0B0B0', display: 'flex', alignItems: 'center', justifyContent: isSidebarCollapsed ? 'center' : 'flex-start', gap: '12px', width: '100%', padding: '12px', cursor: 'pointer', border: 'none' }}>
              <LogOut size={20} /> {!isSidebarCollapsed && 'Logout'}
            </button>
          </div>
        </nav>
      )}

      <main style={{ flex: 1, backgroundColor: '#1A1A1A', overflowY: 'auto', padding: '40px', position: 'relative' }}>
        {isAuthenticated && location.pathname !== '/login' && (
          <div style={{ position: 'absolute', top: '35px', right: '40px', zIndex: 100 }}>
            <Tooltip title={getHelpContent()}>
              <HelpCircle size={22} style={{ color: '#666', cursor: 'help', opacity: 0.8 }} />
            </Tooltip>
          </div>
        )}
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
          <Route path="/dashboard" element={<Navigate to="/" />} />

          <Route path="/oa/:oaId/messages" element={<ProtectedRoute><MessageCenter /></ProtectedRoute>} />
          <Route path="/oa/:oaId/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/oa/:oaId/broadcast" element={<ProtectedRoute><Broadcast /></ProtectedRoute>} />
          <Route path="/oa/:oaId/scheduled-events" element={<ProtectedRoute><ScheduledEvents /></ProtectedRoute>} />
          <Route path="/oa/:oaId/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
          <Route path="/oa/:oaId/richmenu" element={<ProtectedRoute><RichMenu /></ProtectedRoute>} />
          <Route path="/oa/:oaId/questionnaire" element={<ProtectedRoute><Questionnaire /></ProtectedRoute>} />
          <Route path="/oa/:oaId/liff-questionnaire" element={<ProtectedRoute><LiffQuestionnaire /></ProtectedRoute>} />
          <Route path="/oa/:oaId/ruledesigner" element={<ProtectedRoute><RuleDesigner /></ProtectedRoute>} />
          <Route path="/oa/:oaId/dbviewer" element={<ProtectedRoute><DatabaseViewer /></ProtectedRoute>} />

          <Route path="/oa/:oaId/customers" element={<ProtectedRoute><CustomerCenter /></ProtectedRoute>} />
          <Route path="/oa/:oaId/social-radar" element={<ProtectedRoute><SocialRadar /></ProtectedRoute>} />
          <Route path="/oa/:oaId/ai-insight" element={<ProtectedRoute><AiInsight /></ProtectedRoute>} />

          <Route path="/" element={
            isAuthenticated ? (
              myOAs.length > 0 ? (
                <Navigate to={`/oa/${myOAs[0].id}/${PAGE_ROUTE_MAP[myOAs[0].pages[0]?.name] || 'projects'}`} />
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#fff', width: '100%' }}>沒有可用的專案或權限，請聯繫管理員。</div>
              )
            ) : (
              <Navigate to="/login" />
            )
          } />
        </Routes>
      </main>
      {taskState.isProcessing && (
        <StatusIndicator message={taskState.processingMessage} progress={taskState.progress} />
      )}
    </div>
  );
};

const AppContent = () => {
  return (
    <Router>
      <MainLayout />
    </Router>
  );
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ToastProvider>
        <TaskProvider>
          <AuthProvider>
            <AppContent />
            <Toast />
          </AuthProvider>
        </TaskProvider>
      </ToastProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
