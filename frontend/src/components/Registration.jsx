const Registration = ({ 
  inputUsername, 
  inputPassword, 
  onUsernameChange, 
  onPasswordChange, 
  onRegister,
  isLogin,
  onToggleMode 
}) => {
  return (
    <div style={{ padding: 20, fontFamily: 'Arial', maxWidth: 400 }}>
      <h2>Secure Chat - {isLogin ? 'Login' : 'Register'}</h2>
      <div style={{ marginBottom: 10 }}>
        <input 
          value={inputUsername} 
          onChange={e => onUsernameChange(e.target.value)} 
          placeholder="Enter username"
          style={{ padding: 8, width: '100%', marginBottom: 10 }}
          onKeyPress={e => e.key === 'Enter' && onRegister()}
        />
        <input 
          type="password"
          value={inputPassword} 
          onChange={e => onPasswordChange(e.target.value)} 
          placeholder="Enter password"
          style={{ padding: 8, width: '100%', marginBottom: 10 }}
          onKeyPress={e => e.key === 'Enter' && onRegister()}
        />
        <button 
          onClick={onRegister}
          style={{ padding: 8, width: '100%', marginBottom: 10 }}
        >
          {isLogin ? 'Login' : 'Register'}
        </button>
        <div style={{ textAlign: 'center' }}>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              onToggleMode();
            }}
            style={{ fontSize: 14 }}
          >
            {isLogin ? 'Register instead' : 'Login instead'}
          </a>
        </div>
      </div>
    </div>
  );
};

export default Registration;