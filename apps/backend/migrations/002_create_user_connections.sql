-- Create user_connections table
CREATE TABLE user_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('postgresql', 'mysql', 'sqlite')),
  encrypted_config TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP,
  CONSTRAINT unique_user_connection_name UNIQUE(user_id, name)
);

-- Create indexes for performance
CREATE INDEX idx_user_connections_user_id ON user_connections(user_id);
CREATE INDEX idx_user_connections_type ON user_connections(type);
CREATE INDEX idx_user_connections_last_used ON user_connections(last_used);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER update_user_connections_updated_at 
  BEFORE UPDATE ON user_connections 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();