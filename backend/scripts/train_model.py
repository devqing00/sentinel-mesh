import pandas as pd
import numpy as np
import joblib
import os
import json

class SimpleGCN:
    """A pure NumPy implementation of a Graph Convolutional Network (GCN)"""
    def __init__(self, input_dim, hidden_dim, output_dim, epochs=100, lr=0.01):
        self.W1 = np.random.randn(input_dim, hidden_dim) * 0.1
        self.W2 = np.random.randn(hidden_dim, output_dim) * 0.1
        self.epochs = epochs
        self.lr = lr

    def relu(self, x):
        return np.maximum(0, x)
        
    def relu_deriv(self, x):
        return (x > 0).astype(float)

    def fit(self, A_hat, X, y):
        # A_hat is the normalized adjacency matrix D^{-1/2} A D^{-1/2}
        for epoch in range(self.epochs):
            # Forward pass
            Z1 = A_hat.dot(X).dot(self.W1)
            H1 = self.relu(Z1)
            Z2 = A_hat.dot(H1).dot(self.W2)
            preds = Z2.flatten()
            
            # MSE Loss
            error = preds - y
            loss = np.mean(error**2)
            
            # Backward pass
            d_out = error.reshape(-1, 1) * 2 / len(y)
            d_W2 = H1.T.dot(A_hat.T.dot(d_out))
            
            d_H1 = A_hat.T.dot(d_out).dot(self.W2.T)
            d_Z1 = d_H1 * self.relu_deriv(Z1)
            d_W1 = X.T.dot(A_hat.T.dot(d_Z1))
            
            # Gradient descent
            self.W1 -= self.lr * d_W1
            self.W2 -= self.lr * d_W2
            
            if epoch % 20 == 0:
                print(f"Epoch {epoch:3d} | Loss: {loss:.4f}")

    def predict(self, A_hat, X):
        Z1 = A_hat.dot(X).dot(self.W1)
        H1 = self.relu(Z1)
        Z2 = A_hat.dot(H1).dot(self.W2)
        return np.clip(Z2.flatten(), 0, 100)

def main():
    print("Loading data for Temporal GNN...")
    vitals_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "vitals.csv")
    mobility_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "mobility.csv")
    contacts_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "contact_tracing.csv")
    
    vitals = pd.read_csv(vitals_path)
    mobility = pd.read_csv(mobility_path)
    contacts = pd.read_csv(contacts_path)
    
    print("Extracting Node Features...")
    contacts_per_user = contacts.groupby('user_id')['mac'].count().reset_index(name='direct_contacts')
    
    mobility['geohash4'] = mobility['geohash'].astype(str).str[:4]
    traj_shift = (mobility.groupby('user_id')['geohash4'].nunique() * 10).reset_index(name='trajectory_shift')
    
    vitals['user_id'] = vitals['device_id'].str.replace('D', 'U')
    vitals['is_anomaly'] = ((vitals['temp_status'] == 'high') | 
                            (vitals['hr_status'] == 'high') | 
                            (vitals['hr_status'] == 'low')).astype(int)
    anomalies_per_user = vitals.groupby('user_id')['is_anomaly'].sum().reset_index(name='vitals_anomalies')
    
    features = pd.DataFrame({'user_id': pd.concat([contacts['user_id'], mobility['user_id'], vitals['user_id']]).unique()})
    features = features.merge(anomalies_per_user, on='user_id', how='left')
    features = features.merge(contacts_per_user, on='user_id', how='left')
    features = features.merge(traj_shift, on='user_id', how='left')
    features = features.fillna(0)
    
    # Sort user_id to map them to an integer index
    features = features.sort_values('user_id').reset_index(drop=True)
    user_to_idx = {u: i for i, u in enumerate(features['user_id'])}
    
    # Synthetic target risk score
    np.random.seed(42)
    base_score = 5.0
    features['actual_risk_score'] = (
        base_score +
        (np.clip(features['vitals_anomalies'], 0, 10) * 8.0) + 
        (np.log1p(features['direct_contacts']) * 5.0) + 
        (features['trajectory_shift'] * 0.5) +
        (np.clip(features['vitals_anomalies'], 0, 5) * np.log1p(features['direct_contacts']) * 1.5) + 
        np.random.normal(0, 1.5, len(features))
    ).clip(0, 100)
    
    print("Building Graph Adjacency Matrix...")
    num_nodes = len(features)
    A = np.zeros((num_nodes, num_nodes))
    
    # Add self-loops A = A + I
    np.fill_diagonal(A, 1.0)
    
    # We will simulate random connections based on direct_contacts to form an edge list
    # since contact_tracing.csv has MACs but not strictly pairs of user_ids in this mock dataset
    for i in range(num_nodes):
        num_edges = int(features.loc[i, 'direct_contacts'] // 2)
        if num_edges > 0:
            targets = np.random.choice(num_nodes, size=min(num_edges, num_nodes-1), replace=False)
            for t in targets:
                A[i, t] = 1.0
                A[t, i] = 1.0
                
    # Normalize A -> D^{-1/2} A D^{-1/2}
    D = np.sum(A, axis=1)
    D_inv_sqrt = np.power(D, -0.5)
    D_inv_sqrt[np.isinf(D_inv_sqrt)] = 0.
    D_mat_inv_sqrt = np.diag(D_inv_sqrt)
    A_hat = D_mat_inv_sqrt.dot(A).dot(D_mat_inv_sqrt)
    
    X = features[['vitals_anomalies', 'direct_contacts', 'trajectory_shift']].values
    y = features['actual_risk_score'].values
    
    # Normalize X
    X = (X - np.mean(X, axis=0)) / (np.std(X, axis=0) + 1e-8)
    
    print("Training PyTorch Geometric (Mocked via Pure NumPy GCN)...")
    model = SimpleGCN(input_dim=3, hidden_dim=16, output_dim=1, epochs=150, lr=0.05)
    model.fit(A_hat, X, y)
    
    features['predicted_risk'] = model.predict(A_hat, X)
    
    # Save model weights and structure
    model_data = {
        'W1': model.W1.tolist(),
        'W2': model.W2.tolist(),
        'user_to_idx': user_to_idx
    }
    
    model_path = os.path.join(os.path.dirname(__file__), "..", "app", "services", "gnn_model.json")
    with open(model_path, "w") as f:
        json.dump(model_data, f)
    print(f"GNN Model successfully saved to {model_path}")
    
    print("\nSample GNN Predictions vs Actual:")
    sample = features.sort_values('actual_risk_score', ascending=False).head(10)
    print(sample[['user_id', 'actual_risk_score', 'predicted_risk']])

if __name__ == "__main__":
    main()
