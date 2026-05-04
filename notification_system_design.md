# Notification System Design – Full Stack

## Stage 1 – API Endpoints
- GET /notifications (pagination, filter)
- POST /notifications (admin)
- PUT /notifications/:id/read
- DELETE /notifications/:id
- Real-time: WebSockets

## Stage 2 – Database
PostgreSQL. Tables: students, notifications. Index on (studentId, isRead, createdAt). Partition by studentId for scale.

## Stage 3 – Query Optimization
Composite index on (studentID, isRead, createdAt) fixes slow query. 7-day placement notifications:

```sql
SELECT DISTINCT studentId FROM notifications WHERE type='Placement' AND timestamp > NOW() - INTERVAL '7 days';
## Stage 4 – Performance
Redis cache + pagination. Trade-off: memory vs speed.

## Stage 5 – Redesign notify_all
Message queue (Bull). Save to DB first, then async email/push. Retry failures.

## Stage 6 – Priority Notifications
Implemented in frontend with weight (Placement=3, Result=2, Event=1) and recency. Min-heap for dynamic updates.

## Stage 7 – Frontend
React app with All Notifications (filter, pagination, read/unread) and Priority Inbox (selectable top N). Video attached.