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
