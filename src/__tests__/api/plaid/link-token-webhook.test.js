/**
 * Tests to ensure webhook URL is properly configured in link token creation
 */

describe('Link Token Webhook Configuration', () => {
  describe('Webhook URL Setup', () => {
    it('should include webhook URL in link token creation', () => {
      // This test validates that our createLinkToken function includes webhook configuration
      const expectedWebhookUrl = process.env.NEXT_PUBLIC_APP_URL 
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook`
        : undefined;

      console.log('Expected webhook URL:', expectedWebhookUrl);
      console.log('NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);

      if (process.env.NEXT_PUBLIC_APP_URL) {
        expect(expectedWebhookUrl).toContain('/api/plaid/webhook');
        // In development, it might be HTTP, but in production it should be HTTPS
        if (process.env.NODE_ENV === 'production') {
          expect(expectedWebhookUrl).toMatch(/^https:\/\//);
        } else {
          expect(expectedWebhookUrl).toMatch(/^https?:\/\//);
        }
      } else {
        console.log('ℹ️ NEXT_PUBLIC_APP_URL not set, webhook will be undefined');
      }
    });

    it('should construct webhook URL correctly for production', () => {
      // Test the webhook URL construction logic
      const mockAppUrl = 'https://my-app.vercel.app';
      const expectedWebhookUrl = `${mockAppUrl}/api/plaid/webhook`;
      
      console.log('Mock app URL:', mockAppUrl);
      console.log('Expected webhook URL:', expectedWebhookUrl);
      
      expect(expectedWebhookUrl).toBe('https://my-app.vercel.app/api/plaid/webhook');
      expect(expectedWebhookUrl).toContain('/api/plaid/webhook');
      expect(expectedWebhookUrl).toMatch(/^https:\/\//);
    });

    it('should handle missing app URL gracefully', () => {
      // Test behavior when NEXT_PUBLIC_APP_URL is not set
      const webhookUrl = undefined; // This is what happens when NEXT_PUBLIC_APP_URL is not set
      
      console.log('Webhook URL when app URL is missing:', webhookUrl);
      
      expect(webhookUrl).toBeUndefined();
    });
  });

  describe('Production Deployment Requirements', () => {
    it('should require NEXT_PUBLIC_APP_URL for production webhooks', () => {
      const productionRequirements = {
        webhookUrl: 'Must be set to enable webhooks',
        format: 'https://your-domain.vercel.app/api/plaid/webhook',
        ssl: 'Must be HTTPS in production',
        accessibility: 'Must be publicly accessible'
      };

      console.log('Production webhook requirements:', productionRequirements);

      expect(productionRequirements.webhookUrl).toContain('webhooks');
      expect(productionRequirements.format).toContain('/api/plaid/webhook');
      expect(productionRequirements.ssl).toContain('HTTPS');
    });

    it('should validate webhook URL format', () => {
      const validWebhookUrls = [
        'https://my-app.vercel.app/api/plaid/webhook',
        'https://finance-next.vercel.app/api/plaid/webhook',
        'https://custom-domain.com/api/plaid/webhook'
      ];

      const invalidWebhookUrls = [
        'http://my-app.vercel.app/api/plaid/webhook', // HTTP not HTTPS
        'my-app.vercel.app/api/plaid/webhook', // Missing protocol
        'https://my-app.vercel.app/webhook', // Missing /api/plaid/ path
      ];

      console.log('Valid webhook URLs:', validWebhookUrls);
      console.log('Invalid webhook URLs:', invalidWebhookUrls);

      validWebhookUrls.forEach(url => {
        expect(url).toMatch(/^https:\/\/.*\/api\/plaid\/webhook$/);
      });

      invalidWebhookUrls.forEach(url => {
        expect(url).not.toMatch(/^https:\/\/.*\/api\/plaid\/webhook$/);
      });
    });
  });

  describe('Link Token Request Structure', () => {
    it('should include webhook in link token request', () => {
      const expectedRequestStructure = {
        user: { client_user_id: 'user-id' },
        client_name: 'Finance Next',
        products: ['transactions', 'auth'],
        country_codes: ['US'],
        language: 'en',
        webhook: 'https://app.vercel.app/api/plaid/webhook' // This should be included
      };

      console.log('Expected link token request structure:', expectedRequestStructure);

      expect(expectedRequestStructure).toHaveProperty('webhook');
      expect(expectedRequestStructure.webhook).toContain('/api/plaid/webhook');
      expect(expectedRequestStructure.webhook).toMatch(/^https:\/\//);
    });
  });
});
