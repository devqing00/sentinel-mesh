import os
from neo4j import GraphDatabase

class Neo4jClient:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "sentinelpass")
        self.driver = None
        
        # Connect safely to avoid crashing if Neo4j isn't running locally yet
        try:
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
        except Exception as e:
            print(f"Warning: Neo4j could not be reached. Operating in Graph Fallback Mode. Error: {e}")

    def close(self):
        if self.driver:
            self.driver.close()

    def create_user_node(self, user_id, risk_score):
        if not self.driver:
            return
        query = """
        MERGE (u:User {id: $user_id})
        SET u.risk_score = $risk_score
        """
        with self.driver.session() as session:
            session.run(query, user_id=user_id, risk_score=risk_score)

    def create_contact_edge(self, user_a, user_b, weight=1):
        if not self.driver:
            return
        query = """
        MATCH (a:User {id: $user_a})
        MATCH (b:User {id: $user_b})
        MERGE (a)-[r:CONTACTED]->(b)
        SET r.weight = $weight
        """
        with self.driver.session() as session:
            session.run(query, user_a=user_a, user_b=user_b, weight=weight)

    def find_shortest_path(self, start_user, end_user):
        """
        Use Neo4j Graph Data Science / Traversal to find the shortest transmission path
        """
        if not self.driver:
            # Fallback path finding simulation
            return [start_user, "U_UNKNOWN", end_user]
            
        query = """
        MATCH (start:User {id: $start_user}), (end:User {id: $end_user})
        MATCH p = shortestPath((start)-[:CONTACTED*]-(end))
        RETURN [node in nodes(p) | node.id] AS path
        """
        with self.driver.session() as session:
            result = session.run(query, start_user=start_user, end_user=end_user)
            record = result.single()
            return record["path"] if record else []

neo4j_client = Neo4jClient()
