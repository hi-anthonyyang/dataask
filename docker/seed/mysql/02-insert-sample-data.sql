-- Insert sample data for DataAsk MVP testing - MySQL Version
-- This data is designed to demonstrate various AI analysis scenarios

-- Insert sample customers
INSERT INTO customers (name, email, registration_date, city, country) VALUES
('Alice Johnson', 'alice@example.com', '2023-01-15', 'New York', 'USA'),
('Bob Smith', 'bob@example.com', '2023-02-20', 'Los Angeles', 'USA'),
('Carol Davis', 'carol@example.com', '2023-01-10', 'Chicago', 'USA'),
('David Wilson', 'david@example.com', '2023-03-05', 'Houston', 'USA'),
('Emma Brown', 'emma@example.com', '2023-02-14', 'Phoenix', 'USA'),
('Frank Miller', 'frank@example.com', '2023-04-12', 'Philadelphia', 'USA'),
('Grace Lee', 'grace@example.com', '2023-01-28', 'San Antonio', 'USA'),
('Henry Taylor', 'henry@example.com', '2023-03-18', 'San Diego', 'USA'),
('Ivy Chen', 'ivy@example.com', '2023-05-03', 'Dallas', 'USA'),
('Jack Wilson', 'jack@example.com', '2023-04-25', 'San Jose', 'USA'),
('Kate Anderson', 'kate@example.com', '2023-06-10', 'Austin', 'USA'),
('Liam Garcia', 'liam@example.com', '2023-05-15', 'Jacksonville', 'USA'),
('Mia Martinez', 'mia@example.com', '2023-07-02', 'Fort Worth', 'USA'),
('Noah Rodriguez', 'noah@example.com', '2023-06-20', 'Columbus', 'USA'),
('Olivia Hernandez', 'olivia@example.com', '2023-08-14', 'Charlotte', 'USA');

-- Insert sample products
INSERT INTO products (name, category, price, cost, stock_quantity) VALUES
('MacBook Pro', 'Electronics', 1299.99, 899.99, 25),
('iPhone 14', 'Electronics', 999.99, 649.99, 50),
('AirPods Pro', 'Electronics', 249.99, 149.99, 100),
('iPad Air', 'Electronics', 599.99, 399.99, 30),
('Coffee Maker', 'Home & Kitchen', 89.99, 45.99, 75),
('Wireless Mouse', 'Electronics', 29.99, 15.99, 200),
('Standing Desk', 'Office', 299.99, 179.99, 15),
('Monitor 27"', 'Electronics', 399.99, 249.99, 40),
('Ergonomic Chair', 'Office', 449.99, 289.99, 20),
('Bluetooth Speaker', 'Electronics', 79.99, 39.99, 80),
('Yoga Mat', 'Sports', 24.99, 12.99, 150),
('Water Bottle', 'Sports', 19.99, 8.99, 300),
('Notebook Set', 'Office', 14.99, 6.99, 500),
('Desk Lamp', 'Office', 49.99, 24.99, 60),
('Phone Case', 'Electronics', 19.99, 7.99, 400);

-- Insert sample orders (spanning several months)
INSERT INTO orders (customer_id, order_date, total_amount, status) VALUES
(1, '2024-01-05', 1349.98, 'completed'),
(2, '2024-01-08', 999.99, 'completed'),
(3, '2024-01-12', 329.98, 'completed'),
(1, '2024-01-20', 89.99, 'completed'),
(4, '2024-02-03', 1699.98, 'completed'),
(5, '2024-02-15', 599.99, 'completed'),
(2, '2024-02-22', 79.99, 'completed'),
(6, '2024-03-01', 749.98, 'completed'),
(7, '2024-03-10', 299.99, 'completed'),
(3, '2024-03-18', 469.98, 'completed'),
(8, '2024-04-02', 1299.99, 'completed'),
(9, '2024-04-15', 249.99, 'completed'),
(4, '2024-04-20', 49.98, 'completed'),
(10, '2024-05-05', 929.98, 'completed'),
(11, '2024-05-12', 399.99, 'completed'),
(5, '2024-05-25', 129.98, 'completed'),
(12, '2024-06-08', 1549.98, 'completed'),
(13, '2024-06-18', 89.99, 'completed'),
(6, '2024-06-25', 299.98, 'completed'),
(14, '2024-07-10', 79.99, 'completed'),
(15, '2024-07-22', 599.99, 'completed'),
(7, '2024-08-05', 149.98, 'completed'),
(8, '2024-08-15', 449.99, 'completed'),
(9, '2024-08-28', 999.99, 'completed');

-- Insert order items (detailed breakdown of orders)
INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
-- Order 1: MacBook Pro + AirPods Pro
(1, 1, 1, 1299.99), (1, 3, 1, 249.99),
-- Order 2: iPhone 14
(2, 2, 1, 999.99),
-- Order 3: AirPods Pro + Wireless Mouse
(3, 3, 1, 249.99), (3, 6, 1, 29.99),
-- Order 4: Coffee Maker
(4, 5, 1, 89.99),
-- Order 5: MacBook Pro + Monitor
(5, 1, 1, 1299.99), (5, 8, 1, 399.99),
-- Order 6: iPad Air
(6, 4, 1, 599.99),
-- Order 7: Bluetooth Speaker
(7, 10, 1, 79.99),
-- Order 8: Standing Desk + Monitor
(8, 7, 1, 299.99), (8, 8, 1, 399.99), (8, 6, 1, 29.99), (8, 14, 1, 49.99),
-- Order 9: Standing Desk
(9, 7, 1, 299.99),
-- Order 10: Ergonomic Chair + Desk Lamp
(10, 9, 1, 449.99), (10, 14, 1, 49.99),
-- Order 11: MacBook Pro
(11, 1, 1, 1299.99),
-- Order 12: AirPods Pro
(12, 3, 1, 249.99),
-- Order 13: Yoga Mat + Water Bottle
(13, 11, 2, 24.99),
-- Order 14: iPhone 14 + Phone Case + AirPods Pro
(14, 2, 1, 999.99), (14, 15, 1, 19.99), (14, 3, 1, 249.99),
-- Order 15: Monitor
(15, 8, 1, 399.99),
-- Order 16: Bluetooth Speaker + Water Bottle
(16, 10, 1, 79.99), (16, 12, 2, 19.99),
-- Order 17: MacBook Pro + iPad Air + AirPods Pro
(17, 1, 1, 1299.99), (17, 4, 1, 599.99), (17, 3, 1, 249.99),
-- Order 18: Coffee Maker
(18, 5, 1, 89.99),
-- Order 19: Standing Desk + Ergonomic Chair
(19, 7, 1, 299.99), (19, 9, 1, 449.99),
-- Order 20: Bluetooth Speaker
(20, 10, 1, 79.99),
-- Order 21: iPad Air
(21, 4, 1, 599.99),
-- Order 22: Yoga Mat + Water Bottle + Notebook Set
(22, 11, 1, 24.99), (22, 12, 5, 19.99), (22, 13, 2, 14.99),
-- Order 23: Ergonomic Chair
(23, 9, 1, 449.99),
-- Order 24: iPhone 14
(24, 2, 1, 999.99);

-- Insert monthly sales aggregates
INSERT INTO monthly_sales (month, product_id, total_revenue, total_quantity) VALUES
('2024-01-01', 1, 2599.98, 2),
('2024-01-01', 2, 999.99, 1),
('2024-01-01', 3, 499.98, 2),
('2024-01-01', 5, 89.99, 1),
('2024-01-01', 6, 29.99, 1),
('2024-02-01', 1, 1299.99, 1),
('2024-02-01', 4, 599.99, 1),
('2024-02-01', 8, 399.99, 1),
('2024-02-01', 10, 79.99, 1),
('2024-03-01', 7, 599.98, 2),
('2024-03-01', 8, 399.99, 1),
('2024-03-01', 9, 449.99, 1),
('2024-03-01', 14, 49.99, 1),
('2024-04-01', 1, 1299.99, 1),
('2024-04-01', 3, 249.99, 1),
('2024-04-01', 11, 49.98, 2),
('2024-05-01', 2, 999.99, 1),
('2024-05-01', 8, 399.99, 1),
('2024-05-01', 10, 79.99, 1),
('2024-05-01', 12, 39.98, 2),
('2024-05-01', 15, 19.99, 1),
('2024-06-01', 1, 1299.99, 1),
('2024-06-01', 4, 599.99, 1),
('2024-06-01', 3, 249.99, 1),
('2024-06-01', 5, 89.99, 1),
('2024-06-01', 7, 299.99, 1),
('2024-07-01', 10, 79.99, 1),
('2024-07-01', 4, 599.99, 1),
('2024-08-01', 11, 24.99, 1),
('2024-08-01', 12, 99.95, 5),
('2024-08-01', 13, 29.98, 2),
('2024-08-01', 9, 449.99, 1),
('2024-08-01', 2, 999.99, 1);

-- Insert user session data for analytics
INSERT INTO user_sessions (user_id, session_start, session_end, page_views, device_type, referrer) VALUES
('user_001', '2024-08-01 09:15:00', '2024-08-01 09:45:30', 12, 'desktop', 'google.com'),
('user_002', '2024-08-01 10:22:00', '2024-08-01 10:35:15', 6, 'mobile', 'facebook.com'),
('user_003', '2024-08-01 11:30:00', '2024-08-01 12:10:45', 18, 'desktop', 'direct'),
('user_001', '2024-08-02 14:05:00', '2024-08-02 14:25:30', 8, 'desktop', 'direct'),
('user_004', '2024-08-02 15:20:00', '2024-08-02 15:40:12', 10, 'tablet', 'google.com'),
('user_005', '2024-08-02 16:45:00', '2024-08-02 17:15:00', 15, 'desktop', 'linkedin.com'),
('user_002', '2024-08-03 08:30:00', '2024-08-03 08:50:20', 7, 'mobile', 'direct'),
('user_006', '2024-08-03 12:15:00', '2024-08-03 12:45:30', 20, 'desktop', 'google.com'),
('user_007', '2024-08-03 17:20:00', '2024-08-03 17:35:45', 5, 'mobile', 'instagram.com'),
('user_003', '2024-08-04 10:10:00', '2024-08-04 10:55:30', 25, 'desktop', 'direct'); 