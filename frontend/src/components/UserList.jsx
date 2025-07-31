import React from 'react';

const UserList = ({ users, selectedUser, onUserSelect, onRefresh }) => {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3>Users</h3>
        <button onClick={onRefresh} style={{ padding: 8 }}>Refresh Users</button>
      </div>
      <div style={{ border: '1px solid #ccc', padding: 10, borderRadius: 4, maxHeight: 200, overflowY: 'auto' }}>
        {users.length === 0 ? (
          <p style={{ color: '#666' }}>No other users online</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {users.map(u => (
              <li key={u.username} style={{ marginBottom: 5 }}>
                <button 
                  onClick={() => onUserSelect(u.username)}
                  style={{ 
                    padding: 8, 
                    width: '100%', 
                    textAlign: 'left',
                    backgroundColor: selectedUser === u.username ? '#e3f2fd' : 'white'
                  }}
                >
                  {u.username}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default UserList;