const { expect } = require('chai');
const sinon = require('sinon');

// Import the relevant modules and functions
const { authenticate } = require('../../extension/src/authenticate.ts');
const { User } = require('./entities/User');

describe('Authentication Process', () => {
  afterEach(() => {
    // Restore any stubs or mocks after each test
    sinon.restore();
  });

  it('should authorize a paying user', async () => {
    // Stub the findOne method of User to return a paying user
    sinon.stub(User, 'findOne').resolves({ paying: true });

    // Mock the request object with a user ID
    const req = { body: { id: 123 } };

    // Create a response object with a send method for assertions
    const res = {
      status: sinon.stub().returnsThis(), // Chainable status method
      send: sinon.stub(),
    };

    // Call the authenticate function
    await authenticate(req, res);

    // Assertions
    expect(res.status.calledWith(200)).to.be.true;
    expect(res.send.calledWith('Authorized')).to.be.true;
  });

  it('should not authorize a non-paying user', async () => {
    // Stub the findOne method of User to return a non-paying user
    sinon.stub(User, 'findOne').resolves({ paying: false });

    // Mock the request object with a user ID
    const req = { body: { id: 456 } };

    // Create a response object with a send method for assertions
    const res = {
      status: sinon.stub().returnsThis(), // Chainable status method
      send: sinon.stub(),
    };

    // Call the authenticate function
    await authenticate(req, res);

    // Assertions
    expect(res.status.calledWith(401)).to.be.true;
    expect(res.send.calledWith('Not Authorized')).to.be.true;
  });

  it('should handle user not found', async () => {
    // Stub the findOne method of User to return null (user not found)
    sinon.stub(User, 'findOne').resolves(null);

    // Mock the request object with a user ID
    const req = { body: { id: 789 } };

    // Create a response object with a send method for assertions
    const res = {
      status: sinon.stub().returnsThis(), // Chainable status method
      send: sinon.stub(),
    };

    // Call the authenticate function
    await authenticate(req, res);

    // Assertions
    expect(res.status.calledWith(404)).to.be.true;
    expect(res.send.calledWith('User not found')).to.be.true;
  });
});
