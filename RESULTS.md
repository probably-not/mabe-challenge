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

### v4

Replace the original ZSET implementation with a normal SET implementation. Since we are not using anything related to scores in the usage, we can use the lighter SET implementation.

Output:
```
test took: 51438 milliseconds| 51.44 seconds
```

This provides a very minimal performance improvement over the last fastest implementation (which was v2.1), however any performance improvement is still an improvement.

### v5

Evaluate the SHA1 of the Lua script and load the script to the Redis memory. This lowers the amount of bandwidth necessary to make the requests to the server since we only send the SHA1 of the script.

Output:
```
test took: 49199 milliseconds| 49.20 seconds
```

This is a 4.45151% performance boost from the v4 version, and a 168.156% performance boost from the original v0 version!

### v6

Swap Node's raw HTTP module with the turbo-http package. From my tests, this package is faster, and it still answers all of the requirements for the HTTP server that we need for our use case.

Output:
```
test took: 45773 milliseconds| 45.77 seconds
```

This is a 7.22333% performance boost from the v5 version, and a 170.211% performance boost from the original v0 version!

### v7

After some time experimenting and trying to determine the best way to keep optimizing, this latest version swaps out the entire Diff/Filter system with a very simple atomic integer. This integer represents the current index of the cards that we've shown to the user, and since incrementing it is atomic, we can safely ensure that we are accessing each index only once across our two instances.

Output:
```
test took: 20342 milliseconds| 20.34 seconds
```

This is a 76.9324% performance boost from the v6 version, and a 186.191% performance boost from the original v0 version!

### v8

Probably the biggest win yet! After a lot of hacking around, the latest version is fully encapsulated in memory, without the need for any network calls or a Redis. This is made possible by designating a master process which is responsible for the actual indexes, and by utilizing port piping to pipe all requests to a single server.

Output:
```
test took: 4572 milliseconds| 4.57 seconds
```

This is a 126.616% performance boost from the v7 version, and a 196.812% performance boost from the original v0 version!

### v8.1

This is a pretty minor change, and in fact, will probablu slightly negatively affect performance, but only in an extremely minimal way. In local testing, the `req.url` parameter only contains the path of the request, so we can very simply check if it starts with the necessary path. However, in order to not have any issues with `req.url` possibly containing a full url, we need to add some extra conditions to check to see if the path is the path we want to return on. Well, this is the sacrifice we make to lose routing and gain performance.

Output:
```
test took: 4472 milliseconds| 4.47 seconds
```

The performance boost here is minimal and pretty negligible, it's variable, sometimes higher, sometimes lower. Hopefully, it will go lower in the full tests.

### v9

The final step to make a best solution. While the port forwarding took us to everything being all in memory, it still required an extra step in the slow path of forwarding the tcp traffic into the "master" service. With the latest change (which is a bit of a tricky hack), we contain everything in memory. You see, the tester will continue to send requests until all the cards have been visited, but the "All Cards" response does not count against us (you can see this behaviour in the `parseResults` function in the tester's code). So we can split the cards into two slices, and return 0-50 to the master and 50-100 to the worker.

This performance boost took us to the limit, and while it's only slightly faster on the MacBook Pro, it's much faster on the tester machine.