# Results

A place to track the results along with the changes that triggered the results.

## Iterations

### v0

The original code, no changes.

Output:
```
test took: 568816 milliseconds| 568.82 seconds
```

This is approximately 9 minutes and 29 seconds.

### v1

Create a ZSET for all cards, and let Redis compute the difference between the all cards set and the user's seen keys set.

Output:
```
test took: 155919 milliseconds| 155.92 seconds
```

This is approximately 2 minutes and 36 seconds, a 113.944% performance boost!

### v2

Avoid the extra calls to redis by using Lua scripts to update and add to the user's seen cards in an atomic way via a single call to redis.

Output:
```
test took: 52509 milliseconds| 52.51 seconds
```

This is a 99.2276% performance boost from the v1 version, and a 166.195% performance boost from the original v0 version!

### v2.1

Insert the cards to the Redis in bulk. This cuts down on the startup time which saves us about 1 second.

Output:
```
test took: 51607 milliseconds| 51.61 seconds
```

### v3

Swap the node-redis package with the ioredis package, which claims to be more performant.

Output:
```
test took: 53338 milliseconds| 53.34 seconds
```

Interestingly enough, this caused a slowdown in the speed of the testing.
The ioredis package suggests using the auto-pipelining feature to improve performance, so we will try that next.

### v3.1

Add auto-pipelining to the ioredis implementation.

Output:
```
test took: 55758 milliseconds| 55.76 seconds
```

Strangely, this is even slower than without auto-pipelining enabled. With this insight, it looks like we need to revert back to the node-redis library.