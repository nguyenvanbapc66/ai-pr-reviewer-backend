import { Request, Response } from 'express';
import { reviewCode } from '../controllers/reviewController';
import { reviewCodeWithAI } from '../services/openaiService';
import type { ReviewResponseType } from '../types/reviewType';

jest.mock('../services/openaiService');
const mockedReviewCodeWithAI = reviewCodeWithAI as jest.MockedFunction<typeof reviewCodeWithAI>;

describe('Review Controller', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();
    mockResponse = { json: mockJson, status: mockStatus };
  });

  it('should return comments on success', async () => {
    const mockDiff = 'console.log("test");';
    const mockResponseData: ReviewResponseType = {
      comments: [{ id: '1', content: 'Test', type: 'info' }],
    };
    mockRequest = { body: { diff: mockDiff } };
    mockedReviewCodeWithAI.mockResolvedValue(mockResponseData);

    await reviewCode(mockRequest as Request, mockResponse as Response);

    expect(mockedReviewCodeWithAI).toHaveBeenCalledWith({ diff: mockDiff });
    expect(mockJson).toHaveBeenCalledWith(mockResponseData);
    expect(mockStatus).not.toHaveBeenCalled();
  });

  it('should trim whitespace from diff', async () => {
    const mockDiff = '  console.log("test");  ';
    const mockResponseData: ReviewResponseType = { comments: [] };
    mockRequest = { body: { diff: mockDiff } };
    mockedReviewCodeWithAI.mockResolvedValue(mockResponseData);

    await reviewCode(mockRequest as Request, mockResponse as Response);

    expect(mockedReviewCodeWithAI).toHaveBeenCalledWith({ diff: 'console.log("test");' });
    expect(mockJson).toHaveBeenCalledWith(mockResponseData);
  });

  it('should return 400 if diff is missing', async () => {
    mockRequest = { body: {} };
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid input: diff is required and must be a non-empty string',
    });
    expect(mockedReviewCodeWithAI).not.toHaveBeenCalled();
  });

  it('should return 400 if diff is not a string', async () => {
    mockRequest = { body: { diff: 123 } };
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid input: diff is required and must be a non-empty string',
    });
    expect(mockedReviewCodeWithAI).not.toHaveBeenCalled();
  });

  it('should return 400 if diff is empty', async () => {
    mockRequest = { body: { diff: '' } };
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid input: diff is required and must be a non-empty string',
    });
    expect(mockedReviewCodeWithAI).not.toHaveBeenCalled();
  });

  it('should return 400 if diff is only whitespace', async () => {
    mockRequest = { body: { diff: '   \n\t   ' } };
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Invalid input: diff is required and must be a non-empty string',
    });
    expect(mockedReviewCodeWithAI).not.toHaveBeenCalled();
  });

  it('should return 400 if diff is too large', async () => {
    const mockDiff = 'a'.repeat(10001);
    mockRequest = { body: { diff: mockDiff } };
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Diff is too large. Please provide a smaller code diff (max 10,000 characters).',
    });
    expect(mockedReviewCodeWithAI).not.toHaveBeenCalled();
  });

  it('should return 500 if OpenAI service throws', async () => {
    const mockDiff = 'console.log("test");';
    mockRequest = { body: { diff: mockDiff } };
    mockedReviewCodeWithAI.mockRejectedValue(new Error('OpenAI API error'));
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockStatus).toHaveBeenCalledWith(500);
    expect(mockJson).toHaveBeenCalledWith({
      error: 'Internal server error',
      message: 'Failed to review code',
    });
  });

  it('should handle diff with special characters', async () => {
    const mockDiff = 'console.log("!@#$%^&*()");';
    const mockResponseData: ReviewResponseType = { comments: [] };
    mockRequest = { body: { diff: mockDiff } };
    mockedReviewCodeWithAI.mockResolvedValue(mockResponseData);
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockedReviewCodeWithAI).toHaveBeenCalledWith({ diff: mockDiff });
    expect(mockJson).toHaveBeenCalledWith(mockResponseData);
  });

  it('should handle diff with unicode', async () => {
    const mockDiff = 'console.log("🚀✨🎉");';
    const mockResponseData: ReviewResponseType = { comments: [] };
    mockRequest = { body: { diff: mockDiff } };
    mockedReviewCodeWithAI.mockResolvedValue(mockResponseData);
    await reviewCode(mockRequest as Request, mockResponse as Response);
    expect(mockedReviewCodeWithAI).toHaveBeenCalledWith({ diff: mockDiff });
    expect(mockJson).toHaveBeenCalledWith(mockResponseData);
  });
});
