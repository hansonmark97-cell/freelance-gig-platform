const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  if (process.env.NODE_ENV === 'development') {
    const { seed } = require('./seed');
    await seed();
  }
});
